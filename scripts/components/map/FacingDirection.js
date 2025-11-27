/**
 * エンティティの向き（方向）を定義します。
 * 例: 'up', 'down', 'left', 'right'
 */
export class FacingDirection {
    constructor(direction = 'down') {
        this.direction = direction;
    }
}
