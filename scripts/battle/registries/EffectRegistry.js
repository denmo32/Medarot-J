/**
 * @file EffectRegistry.js
 * @description エフェクトタイプと、それを処理するハンドラのマッピングを管理するレジストリ。
 */
import { EffectType } from '../common/constants.js';
import { DamageHandler } from '../logic/effects/DamageHandler.js';
import { HealHandler } from '../logic/effects/HealHandler.js';
import { GuardHandler } from '../logic/effects/GuardHandler.js';
import { GuardConsumeHandler } from '../logic/effects/GuardConsumeHandler.js';
import { ScanHandler } from '../logic/effects/ScanHandler.js';
import { GlitchHandler } from '../logic/effects/GlitchHandler.js';

class EffectRegistryImpl {
    constructor() {
        this.handlers = new Map();
    }

    /**
     * ハンドラを登録する
     * @param {string} type 
     * @param {EffectHandler} handler 
     */
    register(type, handler) {
        this.handlers.set(type, handler);
    }

    /**
     * ハンドラを取得する
     * @param {string} type 
     * @returns {EffectHandler|undefined}
     */
    get(type) {
        return this.handlers.get(type);
    }

    /**
     * デフォルトのハンドラを初期登録する
     */
    initialize() {
        this.register(EffectType.DAMAGE, new DamageHandler());
        this.register(EffectType.HEAL, new HealHandler());
        this.register(EffectType.APPLY_GUARD, new GuardHandler());
        this.register(EffectType.CONSUME_GUARD, new GuardConsumeHandler());
        this.register(EffectType.APPLY_SCAN, new ScanHandler());
        this.register(EffectType.APPLY_GLITCH, new GlitchHandler());
    }
}

export const EffectRegistry = new EffectRegistryImpl();