import { EditorSelection, Text } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';

// --- Helper: Wrap selection or insert placeholder ---
const wrapSelectionWithChars = (view, chars, placeholder) => {
  if (!view) return;
  const changes = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to);
    let change, newSelection;

    if (range.empty) {
      // Insert placeholder text wrapped in chars
      const insertText = chars + placeholder + chars;
      change = { from: range.from, insert: insertText };
      newSelection = EditorSelection.range(
        range.from + chars.length, 
        range.from + chars.length + placeholder.length
      );
    } else {
      // Wrap existing selection
      change = { from: range.from, to: range.to, insert: chars + text + chars };
      newSelection = EditorSelection.range(
        range.from + chars.length, 
        range.to + chars.length
      );
    }
    
    return { changes: [change], range: newSelection };
  });

  view.dispatch(view.state.update(changes, {
    scrollIntoView: true,
    userEvent: 'input.format.wrap' 
  }));
  view.focus();
};

// --- Helper: Apply list formatting ---
const applyListFormatting = (view, listType) => {
  if (!view) return;
  const changes = view.state.changeByRange((range) => {
    const { from, to } = range;
    const startLine = view.state.doc.lineAt(from);
    const endLine = view.state.doc.lineAt(to);
    let changes = [];
    let orderedListCounter = 1; 

    // Determine starting number for ordered list if selection starts mid-list
    if (listType === 'ordered') {
       const lineBeforeStart = startLine.number > 1 ? view.state.doc.line(startLine.number - 1) : null;
       if (lineBeforeStart) {
           const prevLineMatch = lineBeforeStart.text.match(/^\s*(\d+)\.\s+/);
           if (prevLineMatch) {
               orderedListCounter = parseInt(prevLineMatch[1], 10) + 1;
           }
       }
    }

    for (let i = startLine.number; i <= endLine.number; i++) {
      const line = view.state.doc.line(i);
      const lineText = line.text;
      const unorderedMatch = lineText.match(/^(\s*[-*+]\s+)/);
      const orderedMatch = lineText.match(/^(\s*\d+\.\s+)/);

      let newPrefix = '';
      let removePrefixLength = 0;
      let currentNumber = null;

      if (orderedMatch) currentNumber = parseInt(orderedMatch[1].trim().replace('.', ''), 10);

      if (listType === 'unordered') {
        if (unorderedMatch) {
          // Toggle to ordered (figure out starting number)
          const prevLine = i > 1 ? view.state.doc.line(i - 1) : null;
          const prevMatch = prevLine?.text.match(/^\s*(\d+)\.\s+/);
          orderedListCounter = prevMatch ? parseInt(prevMatch[1], 10) + 1 : 1;
          newPrefix = `${orderedListCounter}. `;
          removePrefixLength = unorderedMatch[1].length;
        } else if (orderedMatch) {
          // Toggle off
          removePrefixLength = orderedMatch[1].length;
        } else {
           // Apply unordered
          newPrefix = '- ';
        }
      } else { // listType === 'ordered'
        if (orderedMatch) {
          // Toggle to unordered
          newPrefix = '- '; 
          removePrefixLength = orderedMatch[1].length;
        } else if (unorderedMatch) {
           // Toggle off
          removePrefixLength = unorderedMatch[1].length;
        } else {
           // Apply ordered
           newPrefix = `${orderedListCounter}. `;
        }
      }
      
      // Only increment counter if we are *applying* ordered list format
       if (listType === 'ordered' && newPrefix.match(/^\d+\.\s+/)) {
           newPrefix = `${orderedListCounter}. `; // Ensure correct number is used
           orderedListCounter++;
       } else if (listType === 'unordered' && newPrefix.match(/^\d+\.\s+/)) {
           // Toggling from unordered to ordered uses determined start number
           orderedListCounter++; // Still need to increment for next line
       } else if (orderedMatch && listType === 'ordered' && newPrefix === '- ') {
           // If we toggle ordered to unordered, reset counter for potential subsequent re-numbering needed below
           // This case is handled by the renumbering logic later
       } else if (unorderedMatch && listType === 'unordered' && newPrefix.match(/^\d+\.\s+/)) {
           // Toggling from unordered to ordered uses determined start number
           orderedListCounter++; // Increment for next line
       }


      if (line.length === 0) {
        // Handle empty line - insert placeholder only if applying a list type
        if (newPrefix) {
             const placeholder = newPrefix + 'List Item';
             changes.push({ from: line.from, insert: placeholder });
             if (newPrefix.match(/^\d+\.\s+/)) orderedListCounter++;
        } else {
            // If toggling off on an empty line, do nothing
        }
      } else if (removePrefixLength > 0) {
         // Remove existing prefix, add new one if applicable
         changes.push({ from: line.from, to: line.from + removePrefixLength, insert: newPrefix });
      } else if (newPrefix) {
          // Add new prefix
          changes.push({ from: line.from, insert: newPrefix });
      } else {
        // No change needed for this line (toggling off)
      }
    }

    // Renumber subsequent list items if necessary (only for ordered lists)
    if (listType === 'ordered') {
        let currentLineNum = endLine.number + 1;
        let continueRenumbering = true;
        while (continueRenumbering && currentLineNum <= view.state.doc.lines) {
            const line = view.state.doc.line(currentLineNum);
            const match = line.text.match(/^(\s*)(\d+)(\.\s+)/);
            if (match) {
                const expectedNum = orderedListCounter++;
                const currentNum = parseInt(match[2], 10);
                if (currentNum !== expectedNum) {
                    const newPrefix = `${match[1]}${expectedNum}${match[3]}`;
                    changes.push({ from: line.from, to: line.from + match[0].length, insert: newPrefix });
                }
                currentLineNum++;
            } else {
                continueRenumbering = false; // Stop if we hit a non-list item
            }
        }
    }


    const finalLineEnd = view.state.doc.line(endLine.number).to;
    return { changes, range: EditorSelection.cursor(finalLineEnd) };
  });

  view.dispatch(view.state.update(changes, {
    scrollIntoView: true,
    userEvent: 'input.format.list'
  }));
  view.focus();
};


// --- Exported Commands ---

export const undoCommand = (view) => {
  if (!view) return false;
  return undo(view);
};

export const redoCommand = (view) => {
  if (!view) return false;
  return redo(view);
};

export const applyBold = (view) => {
  wrapSelectionWithChars(view, '**', 'Bold Text');
};

export const applyItalic = (view) => {
  wrapSelectionWithChars(view, '*', 'Italic Text');
};

export const applyCode = (view) => {
  wrapSelectionWithChars(view, '`', 'code');
};

export const applyHeading = (view, level = 2) => {
  if (!view) return;
  const prefix = '#'.repeat(level) + ' ';
  
  const changes = view.state.changeByRange((range) => {
    const { from, to } = range;
    // Operate on full lines
    const startLine = view.state.doc.lineAt(from);
    const endLine = view.state.doc.lineAt(to);
    let changes = [];
    let firstLineChangeFrom = -1;
    let lastLineChangeTo = -1;

    for (let i = startLine.number; i <= endLine.number; i++) {
      const line = view.state.doc.line(i);
      const existingHeadingMatch = line.text.match(/^(#+\s*)/);
      let lineChange = {};

      if (line.length === 0) {
        // Insert placeholder on empty line
        lineChange = { from: line.from, insert: prefix + 'Heading' };
      } else if (existingHeadingMatch) {
        // Replace existing heading prefix if it's different, or remove if it's the same (toggle off)
        if (existingHeadingMatch[1].trim() === '#'.repeat(level)) {
           lineChange = { from: line.from, to: line.from + existingHeadingMatch[1].length }; // Remove
        } else {
           lineChange = { from: line.from, to: line.from + existingHeadingMatch[1].length, insert: prefix }; // Replace
        }
      } else {
        // Prepend heading prefix
        lineChange = { from: line.from, insert: prefix };
      }
      
      changes.push(lineChange);
      if (firstLineChangeFrom === -1) firstLineChangeFrom = lineChange.from;
      lastLineChangeTo = (lineChange.to ?? lineChange.from) + (lineChange.insert?.length ?? 0);
    }
    
    // Select the modified lines or place cursor at end
     const finalSelection = EditorSelection.range(firstLineChangeFrom, lastLineChangeTo);
    
    return { changes, range: finalSelection }; 
  });

  view.dispatch(view.state.update(changes, {
    scrollIntoView: true,
    userEvent: 'input.format.heading'
  }));
  view.focus();
};

export const applyUnorderedList = (view) => {
  applyListFormatting(view, 'unordered');
};

export const applyOrderedList = (view) => {
  applyListFormatting(view, 'ordered');
};

// --- Placeholder Commands (to be implemented) ---

export const applyLink = (view) => {
   if (!view) return;
   
   const changes = view.state.changeByRange((range) => {
       const { from, to } = range;
       let textToInsert = '';
       let selectionStart, selectionEnd;

       if (range.empty) {
           // No selection: Insert placeholder and select "Link Text"
           textToInsert = '[Link Text](URL)';
           selectionStart = from + 1; // After [
           selectionEnd = selectionStart + 'Link Text'.length;
       } else {
           // Selection exists: Use selection as text, select the inserted text
           const selectedText = view.state.sliceDoc(from, to);
           textToInsert = `[${selectedText}](URL)`;
           selectionStart = from + 1; // After [
           selectionEnd = from + 1 + selectedText.length; // End of the original selected text
       }
       
       return { 
           changes: { from: from, to: range.empty ? from : to, insert: textToInsert }, 
           range: EditorSelection.range(selectionStart, selectionEnd)
       };
   });

   view.dispatch(view.state.update(changes, {
       scrollIntoView: true,
       userEvent: 'input.format.link'
   }));
   view.focus();
};

export const applyImage = (view) => {
   if (!view) return;
   // Needs different logic - typically inserts on a new line
   const changes = view.state.changeByRange((range) => {
       const insertText = `\n![Alt Text](image_url)\n`;
       return { 
           changes: { from: range.to, insert: insertText }, 
           range: EditorSelection.cursor(range.to + insertText.length - 2) // Place cursor before final newline
       };
   });
   view.dispatch(view.state.update(changes, { scrollIntoView: true, userEvent: 'input.format.image' }));
   view.focus();
};

export const applyCodeBlock = (view) => {
   if (!view) return;
   const changes = view.state.changeByRange((range) => {
       const { from } = range;
       const line = view.state.doc.lineAt(from);
       const insertText = '\n```\ncode block\n```\n';
       return {
           changes: { from: line.to, insert: insertText },
           range: EditorSelection.range(line.to + 5, line.to + 5 + 10) // Select 'code block'
       };
   });
    view.dispatch(view.state.update(changes, { scrollIntoView: true, userEvent: 'input.format.codeblock' }));
   view.focus();
};

export const applyBlockquote = (view) => {
   if (!view) return;
    const changes = view.state.changeByRange((range) => {
        const { from, to } = range;
        const startLine = view.state.doc.lineAt(from);
        const endLine = view.state.doc.lineAt(to);
        let changes = [];

        for (let i = startLine.number; i <= endLine.number; i++) {
            const line = view.state.doc.line(i);
            const match = line.text.match(/^(\s*>\s*)/);
            if (match) {
                // Toggle off
                changes.push({ from: line.from, to: line.from + match[1].length });
            } else {
                // Toggle on
                changes.push({ from: line.from, insert: '> ' });
            }
        }
        const finalLineEnd = view.state.doc.line(endLine.number).to;
        return { changes, range: EditorSelection.cursor(finalLineEnd) };
    });
     view.dispatch(view.state.update(changes, { scrollIntoView: true, userEvent: 'input.format.blockquote' }));
    view.focus();
};

export const applyTable = (view) => {
   if (!view) return;
   const changes = view.state.changeByRange((range) => {
       const { from } = range;
       const line = view.state.doc.lineAt(from);
       const insertText = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n`;
       return {
           changes: { from: line.to, insert: insertText },
           range: EditorSelection.cursor(line.to + insertText.length - 1)
       };
   });
   view.dispatch(view.state.update(changes, { scrollIntoView: true, userEvent: 'input.format.table' }));
   view.focus();
}; 