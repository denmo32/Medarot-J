/**
 * @file 画面サイズ調整ユーティリティ
 * @description ブラウザのサイズに基づいてゲームの描画領域を調整します。
 */
import { UI_CONFIG } from '../common/UIConfig.js';

/**
 * ゲームの描画領域をブラウザサイズに応じて調整します
 * @param {HTMLElement} gameContainer - ゲームの描画領域を含むコンテナ要素
 */
export function adjustGameScale(gameContainer) {
    if (!gameContainer) {
        console.error('Game container element is required for scaling');
        return;
    }

    const { BASE_WIDTH, BASE_HEIGHT } = UI_CONFIG.SCALING;
    
    // ブラウザの実際のサイズを取得
    const browserWidth = window.innerWidth;
    const browserHeight = window.innerHeight;
    
    // 縦横比を維持しつつ、最大サイズに収まるようにスケールを計算
    const widthRatio = browserWidth / BASE_WIDTH;
    const heightRatio = browserHeight / BASE_HEIGHT;
    const scale = Math.min(widthRatio, heightRatio, 1); // 最大スケールが1を超えないように
    
    // ゲームコンテナにスケールを適用
    gameContainer.style.width = `${BASE_WIDTH * scale}px`;
    gameContainer.style.height = `${BASE_HEIGHT * scale}px`;
    gameContainer.style.transformOrigin = 'top left';
    gameContainer.style.transform = `scale(${scale})`;
    
    return scale;
}

/**
 * ゲーム画面の中央に要素を配置するための計算
 * @param {number} elementWidth - 配置する要素の幅
 * @param {number} elementHeight - 配置する要素の高さ
 * @returns {object} leftとtopのプロパティを持つオブジェクト
 */
export function calculateCenterPosition(elementWidth, elementHeight) {
    const { BASE_WIDTH, BASE_HEIGHT } = UI_CONFIG.SCALING;
    
    return {
        left: (BASE_WIDTH - elementWidth) / 2,
        top: (BASE_HEIGHT - elementHeight) / 2
    };
}

/**
 * ブラウザのリサイズ時に自動的にゲームサイズを調整するリスナーを追加します
 * @param {HTMLElement} gameContainer - ゲームの描画領域を含むコンテナ要素
 * @param {number} [debounceTime=300] - リサイズイベントのデバウンス時間（ミリ秒）
 */
export function addResizeListener(gameContainer, debounceTime = 300) {
    let resizeTimeout;
    
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            adjustGameScale(gameContainer);
        }, debounceTime);
    };
    
    window.addEventListener('resize', handleResize);
    
    // 初期表示時にも調整を適用
    adjustGameScale(gameContainer);
    
    return () => window.removeEventListener('resize', handleResize);
}