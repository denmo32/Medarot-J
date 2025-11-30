/**
 * @file 表示用データを保持するコンポーネント
 * ロジックデータ(Position, Parts)とは分離された、描画専用の状態を持つ。
 */
export class Visual {
    constructor() {
        this.isInitialized = false;
        
        // 基本座標 (Positionコンポーネントと同じ単位: x=ratio, y=%)
        // アニメーションしていない時はPositionと同期され、アニメーション時は独自に動く
        this.x = 0;
        this.y = 0;

        // ピクセル単位のオフセット (振動や微調整用)
        this.offsetX = 0;
        this.offsetY = 0;

        // 変形
        this.scale = 1;
        this.opacity = 1;
        this.zIndex = 0;
        
        // CSSクラス管理
        this.classes = new Set();
        this.lastState = null; // ステート変化検知用
        
        // HPバー表示用データ { partKey: { current, max } }
        // アニメーション中の中間値を保持する
        this.partsInfo = {}; 
        
        // ガードカウンターなどの表示用
        this.guardCount = 0;
    }
}