import React from "react";

const Slider = React.forwardRef(
  ({ className = "", value, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
    // Handle slider change
    const handleChange = (e) => {
      const newValue = parseInt(e.target.value, 10);
      if (onValueChange) {
        onValueChange([newValue]);
      }
    };

    return (
      <div className={`relative w-full touch-none select-none ${className}`}>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
          <div
            className="absolute h-full bg-primary-500"
            style={{
              width: `${((value[0] - min) / (max - min)) * 100}%`,
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={handleChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          ref={ref}
          {...props}
        />
        <div
          className="absolute top-0 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary-500 bg-white dark:bg-surface-800"
          style={{
            left: `calc(${((value[0] - min) / (max - min)) * 100}% - 0.5rem)`,
            top: '50%',
          }}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";

export { Slider }; 