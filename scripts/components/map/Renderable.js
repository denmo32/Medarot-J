/**
 * エンティティが描画可能であることを示し、その方法を定義します。
 */
export class Renderable {
    constructor(shape, color, size) {
        this.shape = shape; // 'circle', 'rect'など
        this.color = color;
        this.size = size;
    }
}
