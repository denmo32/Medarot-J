// renderer.js
import { CONFIG, TILE_TYPES } from './constants.js';

/**
 * 描画全般を管理するクラス
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * 指定されたすべてのオブジェクトを描画する
     * @param {Array<object>} entities - 描画対象のエンティティの配列
     * @param {Map} map - 描画対象のマップ
     * @param {Camera} camera - カメラ
     */
    render(entities, map, camera) {
        // Canvasをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // カメラの位置に合わせて描画コンテキストを移動
        this.ctx.save();
        this.ctx.translate(-camera.x, -camera.y);

        // マップを描画
        map.draw(this, camera);

        // 各エンティティを描画
        for (const entity of entities) {
            entity.draw(this);
        }

        // コンテキストを元の状態に戻す
        this.ctx.restore();
    }
    
    /**
     * 四角形を描画する
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {string} color 
     * @param {string} [borderColor] - (オプション) 枠線の色
     */
    drawRect(x, y, width, height, color, borderColor) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        if (borderColor) {
            this.ctx.strokeStyle = borderColor;
            this.ctx.strokeRect(x, y, width, height);
        }
    }

    /**
     * 円を描画する
     * @param {number} x - 円の中心のx座標
     * @param {number} y - 円の中心のy座標
     * @param {number} radius - 半径
     * @param {string} color - 色
     */
    drawCircle(x, y, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
