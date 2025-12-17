/**
 * @file CombatSystem.js
 * @description 旧戦闘計算システム。
 * 機能は TargetingSystem, ShootSystem, MeleeSystem, SupportActionSystem 等に分割移行されたため、
 * このクラスは実質的に廃止されます。
 * 互換性維持のためクラス自体は残しますが、ロジックは空にします。
 */
import { System } from '../../../../engine/core/System.js';

export class CombatSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // NO-OP: Logic moved to specialized systems.
    }
}