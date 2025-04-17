// This file is executed in the renderer process for the page
// You can access the exposed API through window.api

// Example of using the API from preload.js
console.log(window.api.sayHello());

// You can add more frontend JavaScript here
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
}); 