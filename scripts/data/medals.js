/**
 * @file メダルマスターデータ
 * ゲームに登場する全てのメダルの性能（特に性格）を定義します。
 * メダルIDをキーとしたオブジェクト形式で管理します。
 */
import { MedalPersonality } from '../config/constants.js';

/**
 * メダルのマスターデータ。
 * @property {object} [medalId] - メダルIDをキーとするオブジェクト。
 * @property {string} name - メダルの名前 (UI表示用)。
 * @property {string} personality - メダルの性格 (MedalPersonality定数)。AIの思考パターンを決定します。
 */
export const MEDALS_DATA = {
    'kabuto': {
        id: 'kabuto',
        name: 'カブト',
        personality: MedalPersonality.SPEED,
    },
    'kuwagata': {
        id: 'kuwagata',
        name: 'クワガタ',
        personality: MedalPersonality.SPEED,
    },
	'hunter': {
        id: 'hunter',
        name: 'ハンターテスト',
        personality: MedalPersonality.HUNTER,
    },
    'crusher': {
        id: 'crusher',
        name: 'クラッシャーテスト',
        personality: MedalPersonality.CRUSHER,
    },
    'counter': {
        id: 'counter',
        name: 'カウンターテスト',
        personality: MedalPersonality.COUNTER,
    },
    'joker': {
        id: 'joker',
        name: 'ジョーカーテスト',
        personality: MedalPersonality.JOKER,
    },
    'healer': {
        id: 'healer',
        name: 'ヒーラーテスト',
        personality: MedalPersonality.HEALER,
    },
    'guard': {
        id: 'guard',
        name: 'ガードテスト',
        personality: MedalPersonality.GUARD,
    },
    'assist': {
        id: 'assist',
        name: 'アシストテスト',
        personality: MedalPersonality.ASSIST,
    },
    'focus': {
        id: 'focus',
        name: 'フォーカステスト',
        personality: MedalPersonality.FOCUS,
    },
};