// 一局台麻的狀態機（headless）
// 規則：發牌16張、莊家先摸、補花（含連補）、吃(僅上家)/碰/槓/胡、
//   優先權 胡 > 碰槓 > 吃、四種槓（暗槓/加槓/大明槓/搶槓）＋槓上補牌、
//   榮和/自摸/槓上開花/搶槓算台（高點）、留底16張流局。
// 尚未支援：連莊拉莊、過水詐胡罰則（單機練習用不到）。
import { emptyCounts, KINDS } from '../core/tiles.mjs';
import { isWin, shanten } from '../core/shanten.mjs';
import { scoreWin } from '../core/decompose.mjs';
import { chooseDiscard, evalClaim, evalKong } from '../ai/discard.mjs';

const FLOWER_BASE = 100; // wall 內 100..107 = 花牌1..8

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** 內建 AI 控制器（教練同腦） */
export function aiController() {
  return {
    async discard(view) {
      return chooseDiscard(view.hand, view.meldCount, view.visible, view.table).kind;
    },
    async claim(view, offer) {
      if (offer.type === 'win') return true;
      if (offer.type === 'kong') {
        // 手內槓（暗槓/加槓）：不讓向聽變差就槓
        for (let i = 0; i < offer.options.length; i++) {
          const o = offer.options[i];
          if (evalKong(view.hand, view.meldCount, o).take) return i;
        }
        return null;
      }
      if (offer.type === 'pon') {
        if (offer.canKong && evalKong(view.hand, view.meldCount, { mode: 'minkan', tile: offer.tile }).take)
          return 'kong';
        return evalClaim(view.hand, view.meldCount, { type: 'pon', tile: offer.tile }).take;
      }
      for (const b of offer.bases) {
        if (evalClaim(view.hand, view.meldCount, { type: 'chow', tile: offer.tile, base: b }).take) return b;
      }
      return null;
    },
  };
}

export class Game {
  constructor(opts = {}) {
    this.rng = mulberry32(opts.seed ?? 1);
    this.controllers = opts.controllers ??
      [aiController(), aiController(), aiController(), aiController()];
    this.reserve = opts.reserve ?? 16;
    this.round = opts.round ?? 1;
    this.onEvent = opts.onEvent ?? null;
    this.events = [];
  }

  emit(t, data) {
    const e = { t, ...data };
    this.events.push(e);
    if (this.onEvent) this.onEvent(e);
  }

  buildWall() {
    const wall = [];
    for (let k = 0; k < KINDS; k++) for (let i = 0; i < 4; i++) wall.push(k);
    for (let f = 0; f < 8; f++) wall.push(FLOWER_BASE + f);
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    return wall;
  }

  remaining() { return this.back - this.front + 1; }

  drawFor(seat, fromBack = false) {
    while (true) {
      if (this.remaining() <= this.reserve) return -1;
      const t = fromBack ? this.wall[this.back--] : this.wall[this.front++];
      if (t >= FLOWER_BASE) {
        seat.flowers.push(t - FLOWER_BASE + 1);
        this.emit('flower', { seat: seat.idx, flower: t - FLOWER_BASE + 1 });
        fromBack = true;
        continue;
      }
      return t;
    }
  }

  /** 一組面子佔幾張牌（槓 4 張，其餘 3 張） */
  static meldSize(m) { return m.kind === 'kong' ? 4 : 3; }

  visibleFor() {
    const v = emptyCounts();
    for (const s of this.seats) {
      for (const t of s.river) v[t]++;
      for (const m of s.melds) {
        if (m.kind === 'chow') { v[m.base]++; v[m.base + 1]++; v[m.base + 2]++; }
        else v[m.base] += (m.kind === 'kong' ? 4 : 3);
      }
    }
    return v;
  }

  viewFor(i) {
    const s = this.seats[i];
    return {
      hand: s.hand, melds: s.melds, meldCount: s.melds.length,
      visible: this.visibleFor(), seatWind: s.wind, round: this.round,
      // 公開資訊（牌河＋副露），不含任何人的手牌 → AI 不作弊
      table: {
        meSeat: i,
        turnsPlayed: Math.max(...this.seats.map(x => x.river.length)),
        seats: this.seats.map(x => ({ idx: x.idx, river: x.river, melds: x.melds })),
      },
    };
  }

  ctxFor(s, selfDraw, winTile, extra = {}) {
    return {
      round: this.round, seat: s.wind, selfDraw, winTile,
      flowers: s.flowers, ...extra,
    };
  }

  /** 手內可槓的選項：暗槓（手上4張）/ 加槓（已碰的再摸到第4張） */
  kongOptions(s) {
    const opts = [];
    for (let k = 0; k < KINDS; k++) if (s.hand[k] >= 4) opts.push({ mode: 'ankan', tile: k });
    for (const m of s.melds) {
      if (m.kind === 'pung' && s.hand[m.base] >= 1) opts.push({ mode: 'kakan', tile: m.base });
    }
    return opts;
  }

  /** 有人胡了就回傳結果物件，否則 null */
  async offerWinTo(seats, tile, fromSeat, extra) {
    for (const j of seats) {
      const o = this.seats[j];
      o.hand[tile]++;
      const can = isWin(o.hand, o.melds.length);
      o.hand[tile]--;
      if (!can) continue;
      const take = await this.controllers[j].claim(this.viewFor(j), { type: 'win', tile, ...extra });
      if (!take) { this.emit('declineWin', { seat: j, tile }); continue; }
      o.hand[tile]++;
      const score = scoreWin(o.hand, o.melds, this.ctxFor(o, false, tile, extra));
      this.emit('win', { seat: j, selfDraw: false, from: fromSeat, total: score ? score.total : 0 });
      return { type: 'win', winner: j, selfDraw: false, from: fromSeat, score, events: this.events };
    }
    return null;
  }

  othersOf(seat) { return [1, 2, 3].map(d => (seat + d) % 4); }

  async play() {
    this.wall = this.buildWall();
    this.front = 0; this.back = this.wall.length - 1;
    this.seats = [0, 1, 2, 3].map(i => ({
      idx: i, wind: i + 1, hand: emptyCounts(), melds: [], flowers: [], river: [],
    }));
    for (const s of this.seats) {
      for (let n = 0; n < 16; n++) {
        const t = this.drawFor(s);
        if (t < 0) throw new Error('wall exhausted during deal');
        s.hand[t]++;
      }
    }
    this.emit('deal', {});

    let turn = 0;
    let pendingClaim = null; // 鳴牌後接續打牌的座位

    for (let guard = 0; guard < 600; guard++) {
      const s = this.seats[turn];
      let afterKong = false;

      if (pendingClaim === null) {
        const t = this.drawFor(s);
        if (t < 0) { this.emit('exhaust', {}); return { type: 'draw', events: this.events }; }
        s.hand[t]++;
        this.emit('draw', { seat: turn, tile: t });
      }
      pendingClaim = null;

      // 摸牌後：自摸 → 槓 →（槓後補牌，可連槓）
      let loop = true;
      while (loop) {
        loop = false;

        if (isWin(s.hand, s.melds.length)) {
          const take = await this.controllers[turn].claim(
            this.viewFor(turn), { type: 'win', selfDraw: true, afterKong });
          if (take) {
            const score = scoreWin(s.hand, s.melds, this.ctxFor(s, true, null, afterKong ? { afterKong: true } : {}));
            this.emit('win', { seat: turn, selfDraw: true, afterKong, total: score ? score.total : 0 });
            return { type: 'win', winner: turn, selfDraw: true, score, events: this.events };
          }
          this.emit('declineWin', { seat: turn, selfDraw: true });
        }

        const opts = this.kongOptions(s);
        if (opts.length) {
          const pick = await this.controllers[turn].claim(this.viewFor(turn), { type: 'kong', options: opts });
          const idx = (pick === true) ? 0 : pick;
          if (idx != null && idx !== false && idx >= 0 && idx < opts.length) {
            const o = opts[idx];
            // 加槓 → 別家可搶槓
            if (o.mode === 'kakan') {
              const robbed = await this.offerWinTo(this.othersOf(turn), o.tile, turn, { robKong: true });
              if (robbed) return robbed;
              const m = s.melds.find(x => x.kind === 'pung' && x.base === o.tile);
              m.kind = 'kong'; m.concealed = false;
              s.hand[o.tile]--;
            } else {
              s.hand[o.tile] -= 4;
              s.melds.push({ kind: 'kong', base: o.tile, concealed: true });
            }
            this.emit('kong', { seat: turn, tile: o.tile, mode: o.mode });
            const rt = this.drawFor(s, true);
            if (rt < 0) { this.emit('exhaust', {}); return { type: 'draw', events: this.events }; }
            s.hand[rt]++;
            this.emit('draw', { seat: turn, tile: rt, afterKong: true });
            afterKong = true;
            loop = true; // 回頭再檢查自摸／連槓
          }
        }
      }

      // 打牌
      const cut = await this.controllers[turn].discard(this.viewFor(turn));
      if (s.hand[cut] <= 0) throw new Error(`illegal discard: seat ${turn} kind ${cut}`);
      s.hand[cut]--;
      s.river.push(cut);
      this.emit('discard', { seat: turn, tile: cut });

      // ── 鳴牌窗口：胡 > 碰/槓 > 吃 ──
      const others = this.othersOf(turn);
      const won = await this.offerWinTo(others, cut, turn, {});
      if (won) { s.river.pop(); return won; }

      let claimedBy = null;

      // 碰 / 大明槓
      for (const j of others) {
        const o = this.seats[j];
        if (o.hand[cut] < 2) continue;
        const canKong = o.hand[cut] >= 3;
        const ans = await this.controllers[j].claim(this.viewFor(j), { type: 'pon', tile: cut, canKong });
        if (!ans) continue;
        s.river.pop();
        if (ans === 'kong' && canKong) {
          o.hand[cut] -= 3;
          o.melds.push({ kind: 'kong', base: cut, concealed: false });
          this.emit('kong', { seat: j, tile: cut, mode: 'minkan', from: turn });
          const rt = this.drawFor(o, true);
          if (rt < 0) { this.emit('exhaust', {}); return { type: 'draw', events: this.events }; }
          o.hand[rt]++;
          this.emit('draw', { seat: j, tile: rt, afterKong: true });
          // 槓上開花
          if (isWin(o.hand, o.melds.length)) {
            const take = await this.controllers[j].claim(this.viewFor(j), { type: 'win', selfDraw: true, afterKong: true });
            if (take) {
              const score = scoreWin(o.hand, o.melds, this.ctxFor(o, true, null, { afterKong: true }));
              this.emit('win', { seat: j, selfDraw: true, afterKong: true, total: score ? score.total : 0 });
              return { type: 'win', winner: j, selfDraw: true, score, events: this.events };
            }
            this.emit('declineWin', { seat: j, selfDraw: true });
          }
        } else {
          o.hand[cut] -= 2;
          o.melds.push({ kind: 'pung', base: cut });
          this.emit('pon', { seat: j, tile: cut, from: turn });
        }
        claimedBy = j;
        break;
      }

      // 吃（僅下家）
      if (claimedBy === null && cut < 27) {
        const j = (turn + 1) % 4, o = this.seats[j];
        const pos = cut % 9, B = cut - pos;
        const bases = [];
        for (const st of [cut - 2, cut - 1, cut]) {
          if (st < B || st + 2 > B + 8) continue;
          let ok = true;
          for (let d = 0; d < 3; d++) {
            const t2 = st + d;
            if (t2 === cut) continue;
            if (o.hand[t2] < 1) { ok = false; break; }
          }
          if (ok) bases.push(st);
        }
        if (bases.length) {
          const base = await this.controllers[j].claim(this.viewFor(j), { type: 'chow', tile: cut, bases });
          if (base !== null && base !== false && bases.includes(base)) {
            for (let d = 0; d < 3; d++) { const t2 = base + d; if (t2 !== cut) o.hand[t2]--; }
            o.melds.push({ kind: 'chow', base });
            s.river.pop();
            this.emit('chow', { seat: j, tile: cut, base, from: turn });
            claimedBy = j;
          }
        }
      }

      if (claimedBy !== null) { turn = claimedBy; pendingClaim = claimedBy; }
      else turn = (turn + 1) % 4;
    }
    throw new Error('game exceeded max turns (guard)');
  }
}
