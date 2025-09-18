/**
 * @file 機体構成データ
 * メダロットの機体名と、使用するパーツIDの組み合わせを定義します。
 */

import { PartType } from '../common/constants.js';

export const MEDAROT_SETS = [
    {
        name: 'ライフルテスト',
        parts: {
            [PartType.HEAD]: 'head_001',
            [PartType.RIGHT_ARM]: 'rarm_001',
            [PartType.LEFT_ARM]: 'larm_001',
            [PartType.LEGS]: 'legs_001'
        }
    },
    {
        name: 'ソードテスト',
        parts: {
            [PartType.HEAD]: 'head_002',
            [PartType.RIGHT_ARM]: 'rarm_002',
            [PartType.LEFT_ARM]: 'larm_002',
            [PartType.LEGS]: 'legs_002'
        }
    },
    {
        name: 'ガトリングテスト',
        parts: {
            [PartType.HEAD]: 'head_003',
            [PartType.RIGHT_ARM]: 'rarm_003',
            [PartType.LEFT_ARM]: 'larm_003',
            [PartType.LEGS]: 'legs_003'
        }
    },
    {
        name: 'ハンマーテスト',
        parts: {
            [PartType.HEAD]: 'head_004',
            [PartType.RIGHT_ARM]: 'rarm_004',
            [PartType.LEFT_ARM]: 'larm_004',
            [PartType.LEGS]: 'legs_004'
        }
    },
];