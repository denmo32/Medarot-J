/**
 * @file EffectRenderer.js
 * @description エフェクトエンティティのDOM生成・更新を担当するレンダラー
 */
import { el } from '../../../../../engine/utils/DOMUtils.js';

export class EffectRenderer {
    constructor(battlefield, uiManager) {
        this.battlefield = battlefield;
        this.uiManager = uiManager;
    }

    create(entityId, visual) {
        // CSSアニメーションで制御される要素かどうか
        const isCssControlled = visual.classes.has('battle-start-text');

        const style = {
            position: 'absolute', 
            pointerEvents: 'none',
            willChange: 'transform'
        };

        // CSS制御でない場合は左上原点に配置（その後updateで調整）
        if (!isCssControlled) {
            style.left = '0';
            style.top = '0';
        }

        const element = el('div', {
            className: 'effect-entity',
            style: style
        });
        
        visual.classes.forEach(cls => element.classList.add(cls));
        
        if (visual.classes.has('battle-start-text')) {
             element.textContent = 'ロボトルファイト！';
        }

        this.battlefield.appendChild(element);
        
        this.uiManager.registerEntity(entityId, {
            mainElement: element
        });
    }

    update(entityId, visual, domElements) {
        if (!domElements.mainElement) return;

        const targetElement = domElements.mainElement;
        const { cache } = visual;
        const isCssControlled = visual.classes.has('battle-start-text');

        // --- 位置・スタイル更新 ---
        const isDirty = 
            cache.x !== visual.x ||
            cache.y !== visual.y ||
            cache.offsetX !== visual.offsetX ||
            cache.offsetY !== visual.offsetY ||
            cache.scale !== visual.scale ||
            cache.opacity !== visual.opacity ||
            cache.zIndex !== visual.zIndex;

        if (isDirty && !isCssControlled) {
            const leftPercent = visual.x * 100;
            const topPercent = visual.y;

            targetElement.style.left = `${leftPercent}%`;
            targetElement.style.top = `${topPercent}%`;

            const transform = `translate3d(calc(-50% + ${visual.offsetX}px), calc(-50% + ${visual.offsetY}px), 0) scale(${visual.scale})`;

            targetElement.style.transform = transform;
            targetElement.style.opacity = visual.opacity;
            targetElement.style.zIndex = visual.zIndex || 100;

            cache.x = visual.x;
            cache.y = visual.y;
            cache.offsetX = visual.offsetX;
            cache.offsetY = visual.offsetY;
            cache.scale = visual.scale;
            cache.opacity = visual.opacity;
            cache.zIndex = visual.zIndex;
        }

        // --- クラス更新 ---
        const classesSignature = Array.from(visual.classes).sort().join(' ');
        if (cache.classesSignature !== classesSignature) {
            if (cache.prevClasses) {
                cache.prevClasses.forEach(c => targetElement.classList.remove(c));
            }
            
            // 基本クラスを再設定
            targetElement.className = 'effect-entity';
            visual.classes.forEach(c => targetElement.classList.add(c));
            
            cache.prevClasses = new Set(visual.classes);
            cache.classesSignature = classesSignature;
        }
    }

    remove(entityId) {
        // RenderSystem側で共通の削除ロジックを呼ぶため、ここでは固有のクリーンアップがあれば記述
    }
}