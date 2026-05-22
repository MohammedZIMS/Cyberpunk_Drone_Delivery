const BASE    = 500;
const TIME_B  = 300;
const STORM_B = 250;
const MULTS   = [1, 1.2, 1.5, 2.0, 3.0];

export class ScoreSystem {
  constructor() {
    this.score      = 0;
    this.streak     = 0;
    this.deliveries = 0;
    this.highScore  = parseInt(localStorage.getItem('droneHi') || '0');
  }

  recordDelivery(timeLeft, weather) {
    const timeBonus  = Math.floor((timeLeft / 60) * TIME_B);
    const stormBonus = weather === 'STORM' ? STORM_B : 0;
    const mult       = MULTS[Math.min(this.streak, MULTS.length - 1)];
    const earned     = Math.floor((BASE + timeBonus + stormBonus) * mult);

    this.score      += earned;
    this.streak     += 1;
    this.deliveries += 1;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('droneHi', this.highScore);
    }

    return { earned, timeBonus, stormBonus, mult };
  }

  resetStreak()  { this.streak = 0; }

  reset() {
    this.score      = 0;
    this.streak     = 0;
    this.deliveries = 0;
  }

  getScore()      { return this.score; }
  getStreak()     { return this.streak; }
  getHighScore()  { return this.highScore; }
  getDeliveries() { return this.deliveries; }
  getMult()       { return MULTS[Math.min(this.streak, MULTS.length-1)]; }
}