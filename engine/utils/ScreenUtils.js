/**
 * @file 画面サイズ調整ユーティリティ
 */

export function adjustGameScale(gameContainer, baseWidth, baseHeight) {
    if (!gameContainer) {
        console.error('Game container element is required for scaling');
        return 1;
    }

    const browserWidth = window.innerWidth;
    const browserHeight = window.innerHeight;
    
    const widthRatio = browserWidth / baseWidth;
    const heightRatio = browserHeight / baseHeight;
    const scale = Math.min(widthRatio, heightRatio, 1);
    
    gameContainer.style.width = `${baseWidth * scale}px`;
    gameContainer.style.height = `${baseHeight * scale}px`;
    gameContainer.style.transformOrigin = 'top left';
    gameContainer.style.transform = `scale(${scale})`;
    
    return scale;
}

export function calculateCenterPosition(elementWidth, elementHeight, baseWidth, baseHeight) {
    return {
        left: (baseWidth - elementWidth) / 2,
        top: (baseHeight - elementHeight) / 2
    };
}

export function addResizeListener(gameContainer, baseWidth, baseHeight, debounceTime = 300) {
    let resizeTimeout;
    
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            adjustGameScale(gameContainer, baseWidth, baseHeight);
        }, debounceTime);
    };
    
    window.addEventListener('resize', handleResize);
    adjustGameScale(gameContainer, baseWidth, baseHeight);
    
    return () => window.removeEventListener('resize', handleResize);
}