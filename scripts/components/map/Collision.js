/**
 * エンティティの当たり判定の境界を定義します。
 */
export class Collision {
    constructor(width, height, padding = 2) {
        this.width = width;
        this.height = height;
        this.padding = padding; // 当たり判定を少し小さくするためのパディング
    }
}
