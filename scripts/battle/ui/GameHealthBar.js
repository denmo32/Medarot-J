/**
 * @file GameHealthBar.js
 * @description Web ComponentsによるHPバーの実装。
 */
export class GameHealthBar extends HTMLElement {
    static get observedAttributes() {
        return ['current', 'max', 'label'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    box-sizing: border-box;
                    font-family: 'Roboto Mono', monospace;
                    font-size: 0.7em; /* フォントサイズ微調整 */
                    padding: 0 4px; /* 上下パディング削除 */
                    height: 16px; /* 高さを明示的に制限 */
                }
                .label {
                    width: 1.5em;
                    text-align: center;
                    margin-right: 4px;
                    flex-shrink: 0;
                    line-height: 1;
                }
                .bar-container {
                    flex-grow: 1;
                    height: 8px; /* バーを細く */
                    background-color: #2d3748;
                    border-radius: 3px;
                    border: 1px solid #a0aec0;
                    overflow: hidden;
                    position: relative;
                }
                .bar {
                    height: 100%;
                    width: 100%;
                    transform-origin: left;
                    transition: transform 0.3s ease-out, background-color 0.3s;
                }
                .value {
                    width: 45px;
                    text-align: right;
                    margin-left: 4px;
                    font-weight: bold;
                    color: #e2e8f0;
                    flex-shrink: 0;
                    line-height: 1;
                }
                /* Colors */
                .high { background-color: #68d391; }
                .medium { background-color: #f6e05e; }
                .low { background-color: #f56565; }
                .broken { background-color: #4a5568; }
            </style>
            <span class="label"></span>
            <div class="bar-container">
                <div class="bar"></div>
            </div>
            <span class="value"></span>
        `;
        
        this.labelEl = this.shadowRoot.querySelector('.label');
        this.barEl = this.shadowRoot.querySelector('.bar');
        this.valueEl = this.shadowRoot.querySelector('.value');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this.render();
    }

    render() {
        const current = parseInt(this.getAttribute('current') || '0');
        const max = parseInt(this.getAttribute('max') || '100');
        const label = this.getAttribute('label') || '';

        const ratio = Math.max(0, Math.min(1, current / max));

        this.labelEl.textContent = label;
        this.valueEl.textContent = `${current}/${max}`;
        
        this.barEl.style.transform = `scaleX(${ratio})`;

        this.barEl.className = 'bar';
        if (current <= 0) {
            this.barEl.classList.add('broken');
        } else if (ratio > 0.5) {
            this.barEl.classList.add('high');
        } else if (ratio > 0.2) {
            this.barEl.classList.add('medium');
        } else {
            this.barEl.classList.add('low');
        }
    }
}

if (!customElements.get('game-health-bar')) {
    customElements.define('game-health-bar', GameHealthBar);
}