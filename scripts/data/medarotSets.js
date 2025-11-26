/**
 * @file 機体構成データ
 * メダロットの機体名と、使用するパーツIDの組み合わせを定義します。
 */

// PartInfoを参照することで、パーツに関する定義元を一元化
import { PartInfo } from '../config/constants.js';

export const MEDAROT_SETS = [
    {
        name: 'ライフルテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_001',
            [PartInfo.RIGHT_ARM.key]: 'rarm_001',
            [PartInfo.LEFT_ARM.key]: 'larm_001',
            [PartInfo.LEGS.key]: 'legs_001'
        }
    },

    {
        name: 'ソードテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_002',
            [PartInfo.RIGHT_ARM.key]: 'rarm_002',
            [PartInfo.LEFT_ARM.key]: 'larm_002',
            [PartInfo.LEGS.key]: 'legs_002'
        }
    },

    {
        name: 'ガトリングテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_003',
            [PartInfo.RIGHT_ARM.key]: 'rarm_003',
            [PartInfo.LEFT_ARM.key]: 'larm_003',
            [PartInfo.LEGS.key]: 'legs_003'
        }
    },

    {
        name: 'ハンマーテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_004',
            [PartInfo.RIGHT_ARM.key]: 'rarm_004',
            [PartInfo.LEFT_ARM.key]: 'larm_004',
            [PartInfo.LEGS.key]: 'legs_004'
        }
    },

    {
        name: 'スキャンテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_005',
            [PartInfo.RIGHT_ARM.key]: 'rarm_005',
            [PartInfo.LEFT_ARM.key]: 'larm_005',
            [PartInfo.LEGS.key]: 'legs_005'
        }
    },

    {
        name: 'リペアテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_006',
            [PartInfo.RIGHT_ARM.key]: 'rarm_006',
            [PartInfo.LEFT_ARM.key]: 'larm_006',
            [PartInfo.LEGS.key]: 'legs_006'
        }
    },

    {
        name: 'グリッチテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_007',
            [PartInfo.RIGHT_ARM.key]: 'rarm_007',
            [PartInfo.LEFT_ARM.key]: 'larm_007',
            [PartInfo.LEGS.key]: 'legs_007'
        }
    },

    {
        name: 'ガードテスト',
        parts: {
            [PartInfo.HEAD.key]: 'head_008',
            [PartInfo.RIGHT_ARM.key]: 'rarm_008',
            [PartInfo.LEFT_ARM.key]: 'larm_008',
            [PartInfo.LEGS.key]: 'legs_008'
        }
    },
];