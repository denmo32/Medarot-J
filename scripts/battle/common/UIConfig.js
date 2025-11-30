/**
 * @file UI関連の設定値を一元管理するモジュール
 * UI表示に特化した設定値をここに定義することで、
 * UIとゲームロジックの関心の分離を図ります。
 */
export const UI_CONFIG = {
    // 画面スケーリングの設定
    SCALING: {
        BASE_WIDTH: 1024, // ゲームの基準幅
        BASE_HEIGHT: 576, // ゲームの基準高さ
    },
    
    // アニメーションに関する設定
    ANIMATION: {
        DURATION: 0,        // デフォルトアニメーション時間（ミリ秒）
        EASING: 'ease-out',   // デフォルトイージング
        ATTACK_DURATION: 1024, // 攻撃アニメーション時間
        HP_BAR: {
            DURATION: 256, // HPバー変動時間
            // イージング関数 (Ease Out Quad)
            EASING: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t 
        }
    },
    
    // モーダルに関する設定
    MODAL: {
        FADE_IN_DURATION: 0,   // モーダル表示時のフェードイン時間
        FADE_OUT_DURATION: 0,  // モーダル非表示時のフェードアウト時間
    },
    
    // UI表示に関する設定
    DISPLAY: {
        Z_INDEX: {
            MODAL: 1000,           // モーダルのZインデックス
            TOOLTIP: 900,          // ツールチップのZインデックス
            OVERLAY: 800,          // オーバーレイのZインデックス
        }
    }
};