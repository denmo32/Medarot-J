/**
 * @file VisualizerRegistry.js
 * @description 効果タイプごとの演出タスク生成ロジック（Visualizer）を管理する。
 */
import { EffectType } from '../../../common/constants.js';
import { createUiAnimationTask, createDialogTask } from '../BattleTasks.js';
import { ModalType } from '../../common/constants.js';
import { MessageGenerator } from '../../utils/MessageGenerator.js';

// 共通のメッセージ生成器インスタンス（都度生成を避けるためキャッシュしても良いが、軽量なので都度生成）
const getMessageGenerator = (world) => new MessageGenerator(world);

/**
 * ダメージ・回復系の演出生成
 */
const hpChangeVisualizer = (world, effects, guardianInfo) => {
    const tasks = [];
    const generator = getMessageGenerator(world);
    const sequence = generator.generateDamageResultSequence(effects, guardianInfo);

    for (const step of sequence) {
        if (step.waitForAnimation) {
            // HPバーアニメーションタスク
            tasks.push(createUiAnimationTask('HP_BAR', { effects: step.effects }));
        } else if (step.text) {
            tasks.push(createDialogTask(step.text, { modalType: ModalType.EXECUTION_RESULT }));
        }
    }
    return tasks;
};

/**
 * 支援・妨害系の演出生成
 */
const supportVisualizer = (world, effects) => {
    const tasks = [];
    const generator = getMessageGenerator(world);
    
    // 支援系は通常1つの効果に対して1つのメッセージ
    for (const effect of effects) {
        const message = generator.generateSupportResultMessage(effect);
        tasks.push(createDialogTask(message, { modalType: ModalType.EXECUTION_RESULT }));
    }
    return tasks;
};

// 登録マップ
const visualizers = {
    [EffectType.DAMAGE]: hpChangeVisualizer,
    [EffectType.HEAL]: hpChangeVisualizer,
    [EffectType.APPLY_SCAN]: supportVisualizer,
    [EffectType.APPLY_GLITCH]: supportVisualizer,
    [EffectType.APPLY_GUARD]: supportVisualizer,
    // デフォルトフォールバック
    'DEFAULT': supportVisualizer
};

export class VisualizerRegistry {
    /**
     * 効果リストに対する演出タスクを生成する
     * @param {World} world 
     * @param {Array} effects 
     * @param {object} context { guardianInfo }
     * @returns {Array} タスクリスト
     */
    static createVisualTasks(world, effects, context = {}) {
        if (!effects || effects.length === 0) return [];

        const tasks = [];
        
        // 効果をタイプごとにグルーピングすべきか、順次処理すべきか？
        // ここでは、メインとなる効果（先頭の効果）のタイプに基づいてVisualizerを選択する戦略をとる。
        // 通常、1つのアクションで全く異なる種類の演出が混在することは少ないため。
        const mainEffect = effects[0];
        const visualizer = visualizers[mainEffect.type] || visualizers['DEFAULT'];

        tasks.push(...visualizer(world, effects, context.guardianInfo));

        return tasks;
    }
}