import {PAD_DEFAULTS, padPlan, CLOCKS} from './games-controller-physics.js';

const experiment = (title, instruction, observe, time, part = 'console-experiment', overrides = {}) => {
  const values = Object.fromEntries(['debounce', 'polling', 'display'].map(key => [key, overrides[key] ?? PAD_DEFAULTS[key]]));
  return {title, instruction, observe, values, initialState: {settings: values, time: typeof time === 'function' ? time(padPlan(values)) - CLOCKS.start : time}, reset: true, part, isolate: true, view: 'front'};
};

export const videoGamesConsoleLesson = {
  simple: 'How does a console turn a controller report into a picture, and where does the response time go?',
  overview: 'A console is a computer running game instructions. Its input interface receives controller reports, its CPU updates the game, and its GPU draws images using data in memory. The display shows an older completed image. Open the console, follow one press through these steps, and compare what the game knows with what the player can see.',
  steps: [
    {title: 'Keep instructions and data ready', body: 'Storage retains the installed game. Working memory holds the instructions, objects and image data currently in use. The required data is already loaded when this experiment begins.'},
    {title: 'Receive input', body: 'The controller filters its button contact and returns reports when the host polls. This example queues observed button edges until the game reads them.'},
    {title: 'Update the world', body: 'The CPU applies the game rules to the received input. In this assigned 60 Hz loop, each update changes the character position and counts newly received presses.'},
    {title: 'Render an image', body: 'The GPU uses scene data and drawing commands to produce pixels. This example assigns one 16.7 ms period to rendering; real render times depend on the work and hardware.'},
    {title: 'Show the completed frame', body: 'A video link carries the image to the monitor. The selected extra display delay postpones the visible picture without postponing the game update.'},
    {title: 'Power and cool the computer', body: 'Regulators feed the electronics. A seated heat sink and supported fan carry heat away from the processor. The illustration shows their arrangement, not an electrical or thermal simulation.'},
  ],
  parts: [
    {name: 'Case and supports', role: 'Protect and support the board while leaving openings for ports and airflow.'},
    {name: 'CPU and GPU package', role: 'Update the game and render its images.'},
    {name: 'Working memory', role: 'Hold current game state, drawing data and images.'},
    {name: 'Game storage', role: 'Retain the installed program and assets.'},
    {name: 'Input and display interfaces', role: 'Receive reports and send completed images.'},
    {name: 'Power and cooling', role: 'Supply the electronics and remove heat.'},
    {name: 'External controller and monitor', role: 'Provide input and show the delayed result.'},
    {name: 'Timing and data views', role: 'Compare input milestones, current game state and visible pictures.'},
  ],
  tryIt: [
    experiment('Follow one press', 'Press Play, then inspect any part without changing the moment.', 'The controller button closes, its report reaches the game and a ring eventually appears on the monitor. The picture follows the game update after rendering and display delay.', 0),
    experiment('Inside the console', 'Inspect the cutaway computer. Switch Cutaway off to see its lid.', 'The board rests on standoffs. Input, processor, memory, storage, video and power connections form a complete system; the fan sits over the processor heat sink.', .02, 'console-computer'),
    experiment('The processor’s two roles', 'Inspect the processor package.', 'The blue CPU region represents game updates; the green GPU region represents rendering. They are functions in one illustrative package, not two independently floating computers.', .02, 'console-processor'),
    experiment('Working memory and storage', 'Inspect the processing and memory group.', 'RAM holds the working state and image data. Storage retains the game between sessions. Loading is outside this timed observation; a button press does not reload the game.', .02, 'console-logic'),
    experiment('Filtered but not received', 'Read the milestone view between controller acceptance and the next poll.', 'The controller already says pressed, but the host has not received that report. Changing the polling interval changes this wait.', p => (p.press.registered + p.press.reported) / 2, 'console-pipeline'),
    experiment('Received between updates', 'Inspect the interval between the received report and the next game update.', 'The host has observed the press, but the next game update has not counted it yet. A received input and a changed game state are different moments.', p => (p.press.reported + p.press.frame) / 2, 'console-pipeline'),
    experiment('The next game update', 'Compare the latest game state with the picture currently visible.', 'The game now counts the first press. The displayed snapshot still has no ring because the new image has not finished its path to the screen.', p => p.press.frame + .0001, 'console-frame-data'),
    experiment('Drawing is not displaying', 'Inspect the same comparison midway through rendering.', 'The game has reacted and the GPU is halfway through its assigned frame. The monitor continues showing an older completed image.', p => p.press.frame + p.frame / 2, 'console-frame-data'),
    experiment('Ready but still delayed', 'Compare game and display after rendering finishes but before the image is visible.', 'The first response image is complete, yet the selected display delay keeps it out of view. The game can already be preparing later updates.', p => (p.press.frame + p.frame + p.press.photon) / 2, 'console-frame-data'),
    experiment('First visible response', 'Inspect the monitor just after the first ring appears.', 'With the default settings, the first response becomes visible about 61.7 ms after contact. That is the result of this assigned pipeline, not a console benchmark.', p => p.press.photon + .0001, 'screen'),
    experiment('Where the time goes', 'Read the timing bars and distribution.', 'The first press takes 61.7 ms in this clock alignment. Over uniformly distributed scan, poll and frame phases, the range is 51.4–78.9 ms and the mean is 65.6 ms.', .18, 'latency'),
    experiment('Poll faster', 'Compare the distribution with 1,000 Hz polling.', 'Average report wait falls from 4.0 ms to 0.5 ms, reducing the mean response to 62.1 ms. This particular press still catches the same game update, so its 61.7 ms response is unchanged.', .18, 'latency', {polling: 2}),
    experiment('Wait for more scans', 'Read the milestones with an eight-scan filter.', 'This longer filter delivers the press after an earlier update began. The response moves to the following frame and appears after 78.3 ms.', .20, 'console-pipeline', {debounce: 8}),
    experiment('No debounce', 'Compare game and screen with single-scan decisions and fast polling.', 'The assigned bouncing contact is observed as two presses. Two rings appear from one physical press; faster delivery does not fix a wrongly interpreted input.', .18, 'console-frame-data', {debounce: 1, polling: 2}),
    experiment('A slower display', 'Compare current game state with an 80 ms display delay.', 'The game has received the press but its ring is still absent from the visible picture. The eventual first response is 111.7 ms after contact.', .14, 'console-frame-data', {display: 80}),
    experiment('Remove the extra display delay', 'Inspect the first response with zero additional display delay.', 'The ring appears after about 31.7 ms. Input filtering, polling, the game update and rendering still take time; zero extra display delay does not mean instant response.', p => p.press.photon + .0001, 'screen', {display: 0}),
    experiment('Power and cooling', 'Inspect the regulators, heat sink and fan, then press Play.', 'The heat sink meets the processor region, and the fan has fixed supports and a bearing. Its assigned rotation illustrates cooling hardware; no temperature or cooling capacity is calculated.', .14, 'console-services'),
    experiment('Read the final result', 'Inspect the completed observation, then press Play to repeat.', 'The result states the number of visible presses and first-response time. Replay retains the selected timing settings. The controller button remains held at the end.', .32),
  ],
  deeper: [
    {title: 'CPU and GPU cooperate', body: 'Game code updates objects and prepares drawing commands. Graphics work transforms geometry, shades surfaces and writes image data. Modern hardware can overlap CPU and GPU work; the single fixed render period here is a teaching assumption.'},
    {title: 'The latest state is not the visible state', body: 'Queued work and display processing can leave several game updates between the current simulation and the image on screen. The comparison view shows snapshots of the same model world at two different update times.'},
    {title: 'Input APIs differ', body: 'This example queues changes observed between reports. Some APIs instead expose the latest button state; brief changes can be lost between polls or game updates. The model does not claim that every console preserves every physical press.'},
    {title: 'Faster polling has a specific effect', body: 'Shorter polling intervals reduce one source of waiting. Whether a particular press appears earlier also depends on which game update it reaches. Improving one stage does not remove the other stages.'},
    {title: 'Frame rate is not a latency measurement', body: 'A stream can deliver many frames each second while those frames are old. Render queues, synchronization, scheduling, scan-out and pixel response can all affect the age of the visible image. These need separate measurements on real hardware.'},
    {title: 'The distribution has explicit assumptions', body: 'The latency chart integrates one assigned bounce trace over independent, uniformly distributed scan, poll and frame phases. It is neither a measured population of consoles nor a universal human-perception threshold.'},
  ],
  misconception: 'A console having received an input does not mean the player can already see its result. Game update, rendering and display are separate stages.',
  limits: 'Illustrative console layout with a combined CPU/GPU package, working memory, game storage, low-voltage regulation and cooling. Geometry, package regions and functional board routes are not a product replica or production schematic. The external adapter’s mains side, detailed electronic circuitry, storage loading, operating-system scheduling, wireless links, audio and networking are omitted. Controller scan and contact behavior reuse one assigned input model; unexposed stick settings stay fixed and rumble is disabled. Observed report edges are queued for a fixed 60 Hz game update. Rendering takes exactly one frame period, then a lumped display delay is added; synchronization queues, scan-out, pixel response and variable rendering workloads are not simulated. CPU illumination is an activity marker, not a measured execution duration. The fan has an assigned 30 Hz rotation; heat flow, electrical power and temperatures are not computed. The 300 ms observation runs 50 times slower and ends with the button still held. The two comparison panels are logical snapshots, not extra physical displays or dedicated RAM chips.',
  sources: [
    {title: 'Microsoft Learn: update, render and present a game frame', url: 'https://learn.microsoft.com/en-us/windows/uwp/gaming/tutorial--assembling-the-rendering-pipeline'},
    {title: 'Microsoft Learn: render queues and input-to-display latency', url: 'https://learn.microsoft.com/en-us/windows/uwp/gaming/reduce-latency-with-dxgi-1-3-swap-chains'},
    {title: 'Xbox Wire: CPU, GPU, memory and storage in a console architecture', url: 'https://news.xbox.com/en-us/2020/03/16/xbox-series-x-tech/'},
    {title: 'USB-IF: Human Interface Device input and output reports', url: 'https://www.usb.org/sites/default/files/hid1_12.pdf'},
    {title: 'Texas Instruments: switch debouncing', url: 'https://www.ti.com/document-viewer/lit/html/SCEA094'},
    {title: 'Microsoft Learn: controller state and frame-based input', url: 'https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput'},
  ],
  related: ['Games controller', 'Joystick'],
  quiz: {
    question: 'Why can the game count a press while the monitor still shows no ring?',
    options: ['The new game state still needs to be rendered and pass through the display delay.', 'The monitor sends the button press backward to the controller.', 'Storage must reinstall the game for every press.'],
    answer: 0,
    explanation: 'The game update happens first. A completed image of that state reaches the screen later, after the assigned rendering and display stages.',
  },
};
