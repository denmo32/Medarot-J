/**
 * @file VisualStrategyRegistry.js
 * @description エフェクトタイプごとの演出生成ストラテジーを管理するレジストリ。
 */
import { DefaultVisualStrategy } from './strategies/DefaultVisualStrategy.js';

class VisualStrategyRegistryImpl {
    constructor() {
        this.strategies = new Map();
        this.defaultStrategy = null;
    }

    /**
     * レジストリを初期化する
     * @param {World} world 
     */
    initialize(world) {
        this.defaultStrategy = new DefaultVisualStrategy(world);
        // 必要に応じて個別のStrategyを登録
        // this.register(EffectType.SOME_SPECIAL, new SpecialVisualStrategy(world));
    }

    /**
     * 特定のエフェクトタイプに対するストラテジーを登録する
     * @param {string} effectType 
     * @param {VisualStrategy} strategy 
     */
    register(effectType, strategy) {
        this.strategies.set(effectType, strategy);
    }

    /**
     * 指定されたエフェクトタイプに対応するストラテジーを取得する
     * 登録がない場合はデフォルトストラテジーを返す
     * @param {string} effectType 
     * @returns {VisualStrategy}
     */
    get(effectType) {
        return this.strategies.get(effectType) || this.defaultStrategy;
    }
}

export const VisualStrategyRegistry = new VisualStrategyRegistryImpl();