/**
 * @file マップモード用コンポーネント定義
 * このファイルは、マップ探索モードで使用されるエンティティのデータコンテナを定義します。
 */

/**
 * エンティティのマップ上の位置を定義します。
 */
export class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/**
 * エンティティの速度と移動方向を定義します。
 */
export class Velocity {
    constructor(dx = 0, dy = 0) {
        this.dx = dx;
        this.dy = dy;
    }
}

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

/**
 * エンティティがプレイヤーによって操作可能であることを示すタグコンポーネント。
 * データは持ちません。
 */
export class PlayerControllable {}

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

/**
 * エンティティの状態を定義します (例: 'idle', 'walking')
 */
export class State {
    constructor(initialState) {
        this.value = initialState;
    }
}

/**
 * エンティティの移動先の目標位置を定義します。
 */
export class TargetPosition {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/**
 * エンティティの向き（方向）を定義します。
 * 例: 'up', 'down', 'left', 'right'
 */
export class FacingDirection {
    constructor(direction = 'down') {
        this.direction = direction;
    }
}
