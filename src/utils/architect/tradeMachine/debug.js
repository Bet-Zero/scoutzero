class Debug {
  constructor() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  log(message, data) {
    if (this.enabled) {
      console.log(`[Trade Validator] ${message}`, data || '');
    }
  }

  error(message, error) {
    if (this.enabled) {
      console.error(`[Trade Validator Error] ${message}`, error || '');
    }
  }
}

export default new Debug();
