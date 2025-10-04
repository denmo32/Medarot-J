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
        DURATION: 300,        // デフォルトアニメーション時間（ミリ秒）
        EASING: 'ease-out',   // デフォルトイージング
    },
    
    // モーダルに関する設定
    MODAL: {
        FADE_IN_DURATION: 200,   // モーダル表示時のフェードイン時間
        FADE_OUT_DURATION: 150,  // モーダル非表示時のフェードアウト時間
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