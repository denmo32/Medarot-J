/**
 * @file パーツマスターデータ
 * ゲームに登場するすべてのパーツの性能を定義します。
 * パーツIDをキーとしたオブジェクト形式で管理します。
 */

import { PartType } from '../common/constants.js';

export const PARTS_DATA = {
    // --- 頭部パーツ ---
    [PartType.HEAD]: {
        'head_001': { name: 'ヘッドライフル', hp: 40, maxHp: 40, action: '射撃', type: '撃つ', trait: 'ライフル', success: 70, might: 15, isBroken: false },
        'head_002': { name: 'ヘッドソード', hp: 50, maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 60, might: 10, isBroken: false },
        'head_003': { name: 'ヘッドガトリング', hp: 35, maxHp: 35, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 85, might: 12, isBroken: false },
        'head_004': { name: 'ヘッドハンマー', hp: 30, maxHp: 30, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 50, might: 30, isBroken: false },
    },
    // --- 右腕パーツ ---
    [PartType.RIGHT_ARM]: {
        'rarm_001': { name: 'ライトライフル', hp: 50, maxHp: 50, action: '射撃', type: '撃つ', trait: 'ライフル', success: 65, might: 25, isBroken: false },
        'rarm_002': { name: 'ライトソード', hp: 50, maxHp: 50, action: '格闘', type: '殴る', trait: 'ソード', success: 55, might: 30, isBroken: false },
        'rarm_003': { name: 'ライトガトリング', hp: 45, maxHp: 45, action: '射撃', type: '狙い撃ち', trait: 'ガトリング', success: 75, might: 20, isBroken: false },
        'rarm_004': { name: 'ライトハンマー', hp: 40, maxHp: 40, action: '格闘', type: '我武者羅', trait: 'ハンマー', success: 80, might: 18, isBroken: false },
    },
    // --- 左腕パーツ ---
    [PartType.LEFT_ARM]: {
        'larm_001': { name: 'レフトライフル', hp: 50, maxHp: 50, action: '射撃', type: '狙い撃ち', trait: 'ライフル', success: 70, might: 22, isBroken: false },
        'larm_002': { name: 'レフトソード', hp: 50, maxHp: 50, action: '格闘', type: '我武者羅', trait: 'ソード', success: 50, might: 35, isBroken: false },
        'larm_003': { name: 'レフトガトリング', hp: 45, maxHp: 45, action: '射撃', type: '撃つ', trait: 'ガトリング', success: 60, might: 28, isBroken: false },
        'larm_004': { name: 'レフトハンマー', hp: 70, maxHp: 70, action: '格闘', type: '殴る', trait: 'ハンマー', success: 40, might: 10, isBroken: false },
    },
    // --- 脚部パーツ ---
    [PartType.LEGS]: {
        'legs_001': { name: 'ライフルレッグ', hp: 60, maxHp: 60, mobility: 30, armor: 20, propulsion: 25, stability: 25, isBroken: false },
        'legs_002': { name: 'ソードレッグ', hp: 70, maxHp: 70, mobility: 20, armor: 30, propulsion: 20, stability: 30, isBroken: false },
        'legs_003': { name: 'ガトリングレッグ', hp: 50, maxHp: 50, mobility: 40, armor: 15, propulsion: 30, stability: 20, isBroken: false },
        'legs_004': { name: 'ハンマーレッグ', hp: 45, maxHp: 45, mobility: 50, armor: 10, propulsion: 35, stability: 15, isBroken: false },
    }
};