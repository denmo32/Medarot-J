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
        name: 'カブトメダル',
        personality: MedalPersonality.HUNTER,
    },
    'kuwagata': {
        id: 'kuwagata',
        name: 'クワガタメダル',
        personality: MedalPersonality.CRUSHER,
    },
    'bear': {
        id: 'bear',
        name: 'ベアーメダル',
        personality: MedalPersonality.COUNTER,
    },
    'joker': {
        id: 'joker',
        name: 'ジョーカーメダル',
        personality: MedalPersonality.JOKER,
    },
    'healer': {
        id: 'healer',
        name: 'ヒーラーメダル',
        personality: MedalPersonality.HEALER,
    },
    'guard': {
        id: 'guard',
        name: 'ガードメダル',
        personality: MedalPersonality.GUARD,
    },
    'assist': {
        id: 'assist',
        name: 'アシストメダル',
        personality: MedalPersonality.ASSIST,
    },
    'focus': {
        id: 'focus',
        name: 'フォーカスメダル',
        personality: MedalPersonality.FOCUS,
    },
};