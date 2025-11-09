/**
 * @file メダルマスターデータ
 * ゲームに登場する全てのメダルの性能（特に性格）を定義します。
 * メダルIDをキーとしたオブジェクト形式で管理します。
 */
import { MedalPersonality } from '../common/constants.js';

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
        personality: MedalPersonality.HUNTER,
    },
    'kuwagata': {
        id: 'kuwagata',
        name: 'クワガタ',
        personality: MedalPersonality.CRUSHER,
    },
	'hunter': {
        id: 'hunterTest',
        name: 'ハンターテスト',
        personality: MedalPersonality.HUNTER,
    },
    'crusher': {
        id: 'crusherTest',
        name: 'クラッシャーテスト',
        personality: MedalPersonality.CRUSHER,
    },
    'counter': {
        id: 'counterTest',
        name: 'カウンターテスト',
        personality: MedalPersonality.COUNTER,
    },
    'joker': {
        id: 'jokerTest',
        name: 'ジョーカーテスト',
        personality: MedalPersonality.JOKER,
    },
    'healer': {
        id: 'healerTest',
        name: 'ヒーラーテスト',
        personality: MedalPersonality.HEALER,
    },
    'guard': {
        id: 'guardTest',
        name: 'ガードテスト',
        personality: MedalPersonality.GUARD,
    },
    'assist': {
        id: 'assistTest',
        name: 'アシストテスト',
        personality: MedalPersonality.ASSIST,
    },
    'focus': {
        id: 'focusTest',
        name: 'フォーカステスト',
        personality: MedalPersonality.FOCUS,
    },
};