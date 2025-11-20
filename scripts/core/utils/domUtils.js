/**
 * @file DOM操作ユーティリティ
 * @description UI構築のためのヘルパー関数を提供します。
 */

/**
 * 要素を作成し、属性や子要素を設定するヘルパー関数。
 * ReactのcreateElementライクな構文でDOMツリーを宣言的に記述できます。
 * 
 * @param {string} tag - タグ名 (例: 'div', 'button')
 * @param {object} [attributes={}] - 属性やイベントハンドラ ({ className: '...', onclick: fn, ... })
 * @param {Array<HTMLElement|string>|string|HTMLElement} [children=[]] - 子要素またはテキスト
 * @returns {HTMLElement} 生成されたDOM要素
 */
export const el = (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            // イベントリスナーの設定
            element[key] = value;
        } else if (value !== undefined && value !== null && value !== false) {
            // その他の属性
            element.setAttribute(key, value);
        }
        // プロパティとして設定が必要な場合（例: disabled, value）
        if (key in element) {
            try {
                element[key] = value;
            } catch (e) {
                // 読み取り専用プロパティなどでエラーが出る場合は無視
            }
        }
    }

    const childrenArray = Array.isArray(children) ? children : [children];

    for (const child of childrenArray) {
        if (child === null || child === undefined) {
            continue;
        }
        if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof HTMLElement) {
            element.appendChild(child);
        }
    }

    return element;
};