/**
 * @file パーツデータ構築ユーティリティ
 * マスターデータ、役割定義、行動定義を統合して、
 * ゲーム内で使用する完全なパーツデータオブジェクトを生成する責務を持ちます。
 * entityFactoryとGameDataManagerでのロジック重複を解消します。
 */

import { PARTS_DATA } from './parts.js';
import { ActionDefinitions } from './actionDefinitions.js';
import { PartRoles } from './partRoles.js';

/**
 * パーツIDとスロット情報を元に、戦闘やUIで使用する完全なパーツデータを生成します。
 * マスターデータ、役割定義、行動定義をマージし、初期状態（HPなど）を設定して返します。
 * 
 * @param {string} partId - パーツのID
 * @param {string} partSlotKey - パーツのスロットキー (例: 'head', 'rightArm')
 * @returns {object | null} 構築されたパーツデータ、またはIDが無効な場合はnull
 */
export const buildPartData = (partId, partSlotKey) => {
    // スロットキーとIDに基づいてマスターデータを取得
    const partData = PARTS_DATA[partSlotKey]?.[partId];
    if (!partData) return null;

    // 1. 役割(role)データの取得
    // partData.roleはオブジェクトの場合(上書き設定)と文字列の場合(参照キー)がある
    const roleKey = (typeof partData.role === 'object') ? partData.role.key : partData.role;
    const roleData = Object.values(PartRoles).find(r => r.key === roleKey) || {};

    // 2. 行動定義(action)データの取得
    const actionData = ActionDefinitions[partData.actionKey] || {};

    // 3. データをマージする (優先度: partData > roleData > actionData)
    // これにより、パーツ固有の設定が役割や行動のデフォルト設定を上書きできます。
    const mergedData = { ...actionData, ...roleData, ...partData };

    // roleがオブジェクトで上書きされている場合、その内容をさらにマージ
    if (typeof partData.role === 'object') {
        Object.assign(mergedData, partData.role);
    }
    
    // 4. 実行時の状態プロパティを初期化
    // 戦闘開始時やデータ参照時に、常に最大HPからスタートする状態とする
    mergedData.hp = mergedData.maxHp;
    mergedData.isBroken = false;

    return mergedData;
};