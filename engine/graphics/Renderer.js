/**
 * @file Canvasレンダラー
 * @description 2D描画機能を提供します。
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    drawRect(x, y, width, height, color, borderColor) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        if (borderColor) {
            this.ctx.strokeStyle = borderColor;
            this.ctx.strokeRect(x, y, width, height);
        }
    }

    drawCircle(x, y, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}