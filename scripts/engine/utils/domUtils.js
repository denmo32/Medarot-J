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
        // 1. className
        if (key === 'className') {
            element.className = value;
            continue;
        }
        
        // 2. dataset (オブジェクトとして渡された場合)
        if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
            continue;
        }
        
        // 3. style (オブジェクトとして渡された場合)
        if (key === 'style' && typeof value === 'object') {
            for (const [prop, propValue] of Object.entries(value)) {
                if (prop.startsWith('--')) {
                    element.style.setProperty(prop, propValue);
                } else {
                    // styleプロパティへの直接代入
                    element.style[prop] = propValue;
                }
            }
            continue;
        }
        
        // 4. イベントリスナー
        if (key.startsWith('on') && typeof value === 'function') {
            element[key] = value;
            continue;
        }
        
        // 5. その他の属性・プロパティ
        if (value !== undefined && value !== null && value !== false) {
            // まずHTML属性として設定
            element.setAttribute(key, value);
            
            // DOMプロパティとしても存在する場合は設定を試みる（例: value, checked, disabled, selected）
            // ただし、style や dataset は上で処理済みのためここには来ない
            if (key in element) {
                try {
                    element[key] = value;
                } catch (e) {
                    // 読み取り専用プロパティなどでエラーが出る場合は無視
                }
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