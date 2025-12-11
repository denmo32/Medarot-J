/**
 * @file DOM操作ユーティリティ
 */

export const el = (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
            continue;
        }
        
        if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
            continue;
        }
        
        if (key === 'style' && typeof value === 'object') {
            for (const [prop, propValue] of Object.entries(value)) {
                if (prop.startsWith('--')) {
                    element.style.setProperty(prop, propValue);
                } else {
                    element.style[prop] = propValue;
                }
            }
            continue;
        }
        
        if (key.startsWith('on') && typeof value === 'function') {
            element[key] = value;
            continue;
        }
        
        if (value !== undefined && value !== null && value !== false) {
            element.setAttribute(key, value);
            if (key in element) {
                try {
                    element[key] = value;
                } catch (e) {}
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