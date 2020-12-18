"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../lib/util");
test('applyDefaults() works', () => {
    const given = { a: 1 };
    const defaults = { a: 2, b: 2 };
    const output = util_1.applyDefaults(given, defaults);
    expect(output).toEqual({ a: 1, b: 2 });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlkZWZhdWx0cy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwbHlkZWZhdWx0cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUNBQStDO0FBRS9DLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLEVBQUU7SUFDakMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7SUFDdkIsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUVoQyxNQUFNLE1BQU0sR0FBRyxvQkFBYSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztJQUU5QyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFwcGx5RGVmYXVsdHMgfSBmcm9tICcuLi8uLi9saWIvdXRpbCc7XG5cbnRlc3QoJ2FwcGx5RGVmYXVsdHMoKSB3b3JrcycsICgpID0+IHtcbiAgY29uc3QgZ2l2ZW4gPSB7IGE6IDEgfTtcbiAgY29uc3QgZGVmYXVsdHMgPSB7IGE6IDIsIGI6IDIgfTtcblxuICBjb25zdCBvdXRwdXQgPSBhcHBseURlZmF1bHRzKGdpdmVuLCBkZWZhdWx0cyk7XG5cbiAgZXhwZWN0KG91dHB1dCkudG9FcXVhbCh7IGE6IDEsIGI6IDIgfSk7XG59KTtcbiJdfQ==