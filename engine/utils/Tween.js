/**
 * @file イージング関数ライブラリ
 * @description Tweenの状態管理機能を除去し、純粋な計算関数のみを提供します。
 * 状態はECSのコンポーネント(ActiveTween)として管理されます。
 */
export const Easing = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: t => t * t * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInOutCubic: t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};

/**
 * 補間計算ヘルパー
 */
export const lerp = (start, end, t) => {
    return start + (end - start) * t;
};