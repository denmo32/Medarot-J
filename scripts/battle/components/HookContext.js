/**
 * @file HookContext.js
 * @description フックレジストリの状態を保持するコンポーネント。
 */
import { HookRegistry } from '../definitions/HookRegistry.js';

export class HookContext {
    constructor() {
        this.hookRegistry = new HookRegistry(); // HookRegistryはBattleResolutionServiceで利用
    }
}