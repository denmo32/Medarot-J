/**
 * @file パーツデータ構築ユーティリティ
 */

import { PARTS_DATA } from './parts.js';
import { ActionDefinitions } from './actionDefinitions.js';
import { PartRoles } from './partRoles.js';

export const buildPartData = (partId, partSlotKey) => {
    const partData = PARTS_DATA[partSlotKey]?.[partId];
    if (!partData) return null;

    const roleKey = (typeof partData.role === 'object') ? partData.role.key : partData.role;
    const roleData = Object.values(PartRoles).find(r => r.key === roleKey) || {};

    const actionData = ActionDefinitions[partData.actionKey] || {};

    const mergedData = { ...actionData, ...roleData, ...partData };

    if (typeof partData.role === 'object') {
        Object.assign(mergedData, partData.role);
    }
    
    mergedData.hp = mergedData.maxHp;
    mergedData.isBroken = false;

    return mergedData;
};