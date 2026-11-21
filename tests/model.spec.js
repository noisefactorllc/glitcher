import { test, expect } from '@playwright/test'
import { EffectStack, pickRandomEffectIds } from '../public/js/stack.js'
import { EFFECTS } from '../public/js/effects.js'
import { Lock } from '../public/js/lock.js'

test('an empty stack renders the source without effect parameters', () => {
    const stack = new EffectStack()
    expect(stack.isEmpty).toBe(true)
    expect(stack.buildDsl()).toBe('search synth, filter, classicNoisedeck\n\nmedia().write(o0)\n\nrender(o0)')
    expect(stack.buildLiveParams()).toEqual({})
})

test('slot arrays can be reordered by a caller without changing the stack', () => {
    const stack = new EffectStack()
    const first = stack.add('corrupt')
    const second = stack.add('corrupt')
    expect(first.uid).not.toBe(second.uid)
    stack.slots.reverse().pop()
    expect(stack.slots.map(slot => slot.uid)).toEqual([first.uid, second.uid])
})

test('moves clamp to either end and unknown slots leave the order intact', () => {
    const stack = new EffectStack()
    const first = stack.add('corrupt')
    const second = stack.add('corrupt')
    expect(stack.move(first.uid, 100)).toBe(true)
    expect(stack.slots.map(slot => slot.uid)).toEqual([second.uid, first.uid])
    expect(stack.move(first.uid, -100)).toBe(true)
    expect(stack.move('missing', 0)).toBe(false)
    expect(stack.remove('missing')).toBe(false)
    expect(stack.slots.map(slot => slot.uid)).toEqual([first.uid, second.uid])
    expect(stack.remove(first.uid)).toBe(true)
    expect(stack.slots.map(slot => slot.uid)).toEqual([second.uid])
})

test('intensity is bounded and an unknown slot cannot change another slot', () => {
    const stack = new EffectStack()
    const slot = stack.add('corrupt')
    expect(stack.setIntensity(slot.uid, -1)).toBe(true)
    expect(stack.slots[0].intensity).toBe(0)
    expect(stack.setIntensity(slot.uid, 101)).toBe(true)
    expect(stack.slots[0].intensity).toBe(100)
    expect(stack.setIntensity('missing', 50)).toBe(false)
    expect(stack.slots[0].intensity).toBe(100)
})

test('saved rolls survive restoration while removed effects are ignored', () => {
    const stack = new EffectStack()
    const rolled = { intensity: 37, sort: 42 }
    stack.replaceFromSnapshot([
        { effectId: 'removed-effect', intensity: 100, rolled: {} },
        { effectId: 'corrupt', intensity: 100, rolled },
    ])
    expect(stack.length).toBe(1)
    expect(stack.slots[0].rolled).toEqual(rolled)
    expect(stack.buildLiveParams()).toEqual({
        step_1: { ...EFFECTS.corrupt.defaults, ...rolled },
    })
})

test('live parameter indices follow the stack after a reorder', () => {
    const stack = new EffectStack()
    stack.replace([
        { effectId: 'corrupt', intensity: 100, rolled: { intensity: 17 } },
        { effectId: 'corrupt', intensity: 100, rolled: { intensity: 83 } },
    ])
    stack.move(stack.slots[0].uid, 1)
    expect(stack.buildLiveParams().step_1.intensity).toBe(83)
    expect(stack.buildLiveParams().step_2.intensity).toBe(17)
    expect(stack.buildLiveParams()).not.toHaveProperty('step_0')
    stack.clear()
    expect(stack.isEmpty).toBe(true)
    expect(stack.buildLiveParams()).toEqual({})
})

test('random effect selection is distinct and stops when the catalog is exhausted', () => {
    const ids = Object.keys(EFFECTS)
    const selected = pickRandomEffectIds(ids.length + 1)
    expect(selected.slice().sort()).toEqual(ids.sort())
    expect(pickRandomEffectIds(0)).toEqual([])
})

test('exclusive work is refused while held and releases after an exception', async () => {
    const lock = new Lock()
    lock.acquire()
    let called = false
    expect(await lock.with(() => { called = true })).toBe(false)
    expect(called).toBe(false)
    lock.release()
    await expect(lock.with(() => { throw new Error('failed work') })).rejects.toThrow('failed work')
    expect(lock.isHeld()).toBe(false)
    expect(await lock.with(() => { called = true })).toBe(true)
    expect(called).toBe(true)
    expect(lock.isHeld()).toBe(false)
})

test('queued lock owners receive access in order without exposing an unlocked gap', async () => {
    const lock = new Lock()
    await lock.acquireWhenFree()
    const order = []
    const first = lock.acquireWhenFree().then(() => order.push('first'))
    const second = lock.acquireWhenFree().then(() => order.push('second'))
    expect(order).toEqual([])
    lock.release()
    await first
    expect(order).toEqual(['first'])
    expect(lock.isHeld()).toBe(true)
    lock.release()
    await second
    expect(order).toEqual(['first', 'second'])
    expect(lock.isHeld()).toBe(true)
    lock.release()
    expect(lock.isHeld()).toBe(false)
})
