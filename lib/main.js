"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const wait_1 = require("./wait");
async function run() {
    try {
        const ms = core.getInput('milliseconds');
        core.debug(`Waiting ${ms} milliseconds ...`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
        core.debug(new Date().toTimeString());
        await wait_1.wait(parseInt(ms, 10));
        core.debug(new Date().toTimeString());
        core.setOutput('time', new Date().toTimeString());
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
void run();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0NBQXNDO0FBQ3RDLGlDQUE4QjtBQUU5QixLQUFLLFVBQVUsR0FBRztJQUNoQixJQUFJO1FBQ0YsTUFBTSxFQUFFLEdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsNEVBQTRFO1FBRTFILElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sV0FBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUV0QyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7S0FDbkQ7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQy9CO0FBQ0gsQ0FBQztBQUVELEtBQUssR0FBRyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjb3JlIGZyb20gJ0BhY3Rpb25zL2NvcmUnO1xuaW1wb3J0IHsgd2FpdCB9IGZyb20gJy4vd2FpdCc7XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBtczogc3RyaW5nID0gY29yZS5nZXRJbnB1dCgnbWlsbGlzZWNvbmRzJyk7XG4gICAgY29yZS5kZWJ1ZyhgV2FpdGluZyAke21zfSBtaWxsaXNlY29uZHMgLi4uYCk7IC8vIGRlYnVnIGlzIG9ubHkgb3V0cHV0IGlmIHlvdSBzZXQgdGhlIHNlY3JldCBgQUNUSU9OU19SVU5ORVJfREVCVUdgIHRvIHRydWVcblxuICAgIGNvcmUuZGVidWcobmV3IERhdGUoKS50b1RpbWVTdHJpbmcoKSk7XG4gICAgYXdhaXQgd2FpdChwYXJzZUludChtcywgMTApKTtcbiAgICBjb3JlLmRlYnVnKG5ldyBEYXRlKCkudG9UaW1lU3RyaW5nKCkpO1xuXG4gICAgY29yZS5zZXRPdXRwdXQoJ3RpbWUnLCBuZXcgRGF0ZSgpLnRvVGltZVN0cmluZygpKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb3JlLnNldEZhaWxlZChlcnJvci5tZXNzYWdlKTtcbiAgfVxufVxuXG52b2lkIHJ1bigpOyJdfQ==