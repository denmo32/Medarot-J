/**
 * @file パーツデータ構築ユーティリティ
 * @description parts.js の数値データに typeDefinitions や actionDefinitions の
 * 振る舞い定義をマージして、システムで利用可能な完全なパーツデータを構築します。
 */

import { PARTS_DATA } from './parts.js';
import { TypeDefinitions } from './typeDefinitions.js';
import { ActionDefinitions } from './actionDefinitions.js';
import { PartRoles } from './partRoles.js';
import { TraitDefinitions } from './traitDefinitions.js';

export const buildPartData = (partId, partSlotKey) => {
    const partStats = PARTS_DATA[partSlotKey]?.[partId];
    if (!partStats) return null;

    // 1. タイプ定義の取得 (脚部などタイプがない場合は空オブジェクト)
    const typeDef = partStats.type ? TypeDefinitions[partStats.type] : {};
    
    // 2. ロール定義の取得 (AI判断用)
    const roleKey = typeDef.roleKey;
    const roleData = roleKey ? (PartRoles[roleKey] || {}) : {};

    // 3. アクション定義の取得 (実行ロジック用)
    const actionKey = typeDef.actionKey;
    const actionData = actionKey ? (ActionDefinitions[actionKey] || {}) : {};

    // 4. 特性定義の取得 (ステータス補正等)
    const traitDef = partStats.trait ? (TraitDefinitions[partStats.trait] || {}) : {};

    // 5. データの統合
    // 優先順位: パーツ個別諸元 > タイプ定義 > アクション定義 > ロール定義
    const mergedData = { 
        ...roleData, 
        ...actionData, 
        ...typeDef, 
        ...traitDef,
        ...partStats 
    };

    // UI互換性のための調整: typeDefinitions の actionLabel を action プロパティへ
    if (typeDef.actionLabel) {
        mergedData.action = typeDef.actionLabel;
    }

    // 初期状態の設定
    mergedData.hp = mergedData.maxHp;
    mergedData.isBroken = false;

    return mergedData;
};