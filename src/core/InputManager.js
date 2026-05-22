export class InputManager {
  constructor() {
    // Set of currently pressed KeyboardEvent.code strings. 
    this._keys = new Set();

    this._bindEvents();
  }

  // Event binding

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);

      // Prevent the browser from scrolling or triggering its own shortcuts
      const block = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
      if (block.includes(e.code)) e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });

    // Clear all keys when the tab loses focus to avoid "stuck key" bugs
    window.addEventListener('blur', () => this._keys.clear());
  }

  // Public API 

  // Returns true while the given key code is held down. 
  isDown(code) {
    return this._keys.has(code);
  }

  
  axis(negCode, posCode) {
    return (this.isDown(posCode) ? 1 : 0) - (this.isDown(negCode) ? 1 : 0);
  }
}