import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8123/tests/e2e/fixture.html');
    await page.waitForFunction(() => (window as any).__ready);
});

test('text mode renders an SVG with a viewBox in a real browser', async ({ page }) => {
    const svg = await page.evaluate(async () => {
        const { fitfull } = (window as any).__fitfull;
        const bytes = await (window as any).__interBytes;
        const result = await fitfull({
            text: 'Hello', font: 'Inter', fontWeight: 'regular',
            width: 200, height: 60,
            fonts: [{ family: 'Inter', weight: 'regular', bytes }],
        });
        return result.svg;
    });
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="0 0/);
});

test('html mode works via the real DOMParser', async ({ page }) => {
    const svg = await page.evaluate(async () => {
        const { Fitfull } = (window as any).__fitfull;
        const bytes = await (window as any).__interBytes;
        const ff = new Fitfull();
        ff.registerFont('Inter', 'regular', bytes);
        const result = await ff.fit({
            html: '<body style="font-family: Inter; font-size: 16px"><p>Hello world</p></body>',
            width: 300, height: 80,
        });
        return result.svg;
    });
    expect(svg).toContain('<svg');
});

test('an unregistered font throws the clear error', async ({ page }) => {
    const message = await page.evaluate(async () => {
        const { Fitfull } = (window as any).__fitfull;
        const ff = new Fitfull();
        try {
            await ff.fit({ text: 'Hi', font: 'Helvetica', fontWeight: 'regular', width: 200, height: 60 });
            return 'NO ERROR';
        } catch (e) {
            return (e as Error).message;
        }
    });
    expect(message).toMatch(/not registered/i);
});
