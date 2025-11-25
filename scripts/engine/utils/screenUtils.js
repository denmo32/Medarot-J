/**
 * @file 画面サイズ調整ユーティリティ
 * @description ブラウザのサイズに基づいてゲームの描画領域を調整する汎用関数群。
 * 特定の設定オブジェクトに依存せず、パラメータとして基準サイズを受け取ります。
 */

/**
 * ゲームの描画領域をブラウザサイズに応じて調整します
 * @param {HTMLElement} gameContainer - ゲームの描画領域を含むコンテナ要素
 * @param {number} baseWidth - ゲームの基準幅
 * @param {number} baseHeight - ゲームの基準高さ
 * @returns {number} 適用されたスケール値
 */
export function adjustGameScale(gameContainer, baseWidth, baseHeight) {
    if (!gameContainer) {
        console.error('Game container element is required for scaling');
        return 1;
    }

    // ブラウザの実際のサイズを取得
    const browserWidth = window.innerWidth;
    const browserHeight = window.innerHeight;
    
    // 縦横比を維持しつつ、最大サイズに収まるようにスケールを計算
    const widthRatio = browserWidth / baseWidth;
    const heightRatio = browserHeight / baseHeight;
    const scale = Math.min(widthRatio, heightRatio, 1); // 最大スケールが1を超えないように
    
    // ゲームコンテナにスケールを適用
    gameContainer.style.width = `${baseWidth * scale}px`;
    gameContainer.style.height = `${baseHeight * scale}px`;
    gameContainer.style.transformOrigin = 'top left';
    gameContainer.style.transform = `scale(${scale})`;
    
    return scale;
}

/**
 * ゲーム画面の中央に要素を配置するための計算
 * @param {number} elementWidth - 配置する要素の幅
 * @param {number} elementHeight - 配置する要素の高さ
 * @param {number} baseWidth - ゲームの基準幅
 * @param {number} baseHeight - ゲームの基準高さ
 * @returns {object} leftとtopのプロパティを持つオブジェクト
 */
export function calculateCenterPosition(elementWidth, elementHeight, baseWidth, baseHeight) {
    return {
        left: (baseWidth - elementWidth) / 2,
        top: (baseHeight - elementHeight) / 2
    };
}

/**
 * ブラウザのリサイズ時に自動的にゲームサイズを調整するリスナーを追加します
 * @param {HTMLElement} gameContainer - ゲームの描画領域を含むコンテナ要素
 * @param {number} baseWidth - ゲームの基準幅
 * @param {number} baseHeight - ゲームの基準高さ
 * @param {number} [debounceTime=300] - リサイズイベントのデバウンス時間（ミリ秒）
 * @returns {Function} リスナー解除用の関数
 */
export function addResizeListener(gameContainer, baseWidth, baseHeight, debounceTime = 300) {
    let resizeTimeout;
    
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            adjustGameScale(gameContainer, baseWidth, baseHeight);
        }, debounceTime);
    };
    
    window.addEventListener('resize', handleResize);
    
    // 初期表示時にも調整を適用
    adjustGameScale(gameContainer, baseWidth, baseHeight);
    
    return () => window.removeEventListener('resize', handleResize);
}