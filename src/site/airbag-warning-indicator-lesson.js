export const airbagWarningIndicatorLesson = {
  "simple": "How does a warning command become light, and what happens if the lamp cannot draw current? Follow the switched LED circuit, then compare its light, current and backup indication.",
  "overview": "The book labels the dashboard airbag warning light. This lesson extends that caption with manufacturer descriptions of startup indication and backup tones, plus an original teaching circuit. A chosen 12 V source, electronic switch, 1 kΩ resistor and red LED form one connected branch. Current determines illumination. The monitor requests light during the first six simulated seconds or while an imposed external report is present. It also observes current: a missing startup current can retain a separate backup request. Twelve simulated seconds play in six display seconds. These component values, the one-second qualification and the tone cadence illustrate the mechanism; they are not a vehicle wiring diagram or diagnostic specification.",
  "related": [
    "Crash sensor",
    "Microchip deceleration sensor",
    "Crash-sensor proof square and sensing strips"
  ],
  "steps": [
    {
      "title": "Supply a complete branch",
      "body": "Trace the copper conductors from the positive terminal, through the switch, resistor and LED, and back to the negative terminal. Closing only the switch is not enough if another part of the branch is open. Blue connections show command and sensing information."
    },
    {
      "title": "Request the startup light",
      "body": "For 0 ≤ t < 6 simulated seconds, the powered monitor asks the electronic switch to conduct. A working branch draws 10 mA and lights the LED. The six-second value is a nominal example from manufacturer descriptions, not a universal specification. Inspect 3 s, then the 6 s boundary."
    },
    {
      "title": "Limit current through the LED",
      "body": "The chosen LED approximation drops 2 V while conducting, leaving 10 V across the 1 kΩ resistor. Current is therefore 10 mA. The resistor dissipates 100 mW and the LED receives 20 mW of electrical power. The LED input is not all visible light, and temperature is not calculated."
    },
    {
      "title": "Let the report keep the switch on",
      "body": "After startup, an imposed external report can still request light. A report from the start keeps the switch conducting; a report beginning at 8 s creates a 6–8 s off interval. These reports stand for other restraint-system checks whose internal mechanisms are outside this model."
    },
    {
      "title": "Open the lamp lead",
      "body": "Choose Cannot illuminate. A visible gap in the LED lead interrupts the series branch, so current is zero even while the switch is conducting. The monitor senses voltage across the series resistor without drawing current from that measurement. Zero resistor voltage means zero branch current in this ideal circuit."
    },
    {
      "title": "Retain evidence and drive the backup sounder",
      "body": "During a requested on interval, current below the chosen 1 mA threshold is missing. One continuous second of missing startup current retains a backup request. Inspect backup onset at 1 s: the sounder begins its five-pulse pattern. Select Sound on and Play to hear the optional synthesized tone. A later off command does not erase the recorded observation."
    },
    {
      "title": "Distinguish a stuck switch from a report",
      "body": "Stuck illuminated holds the electronic switch conducting while powered. At 7 s with no report, command is off but current and light remain on. With a continuous on request, a working and a stuck switch look identical throughout the record. Neither the light nor this limited missing-current check proves every circuit function works."
    },
    {
      "title": "Compare the present with retained history",
      "body": "The report, command and light records keep only observed time, including exact edges at 6 and 8 s. Missing-current memory is separate from instantaneous command/light agreement. At 7 s an open lamp can be dark as commanded while its backup request remains recorded. Reset, physical control edits and replay start fresh trials; inspection preserves the selected circuit or record view."
    }
  ],
  "parts": [
    {
      "name": "Connected lamp-drive circuit",
      "role": "Groups the supply, switched LED branch, monitor and backup sounder for inspection."
    },
    {
      "name": "Circuit mounting board",
      "role": "Supports the teaching components; sizes and layout are illustrative."
    },
    {
      "name": "12 V teaching supply",
      "role": "Supplies the LED branch and monitor. Common power off also disables the backup."
    },
    {
      "name": "Controlled electronic switch",
      "role": "Completes the high-side route when commanded or when stuck conducting. Its visible bar is an equivalent state symbol, not a mechanical contact inside a semiconductor."
    },
    {
      "name": "Current-limiting resistor",
      "role": "Chosen 1 kΩ series element limits current and supplies the ideal voltage-sense signal."
    },
    {
      "name": "AIRBAG warning LED",
      "role": "A red lens and connected leads show the light source. An open lead interrupts the branch in the Cannot illuminate experiment."
    },
    {
      "name": "Lamp branch and return",
      "role": "Copper conductors connect every series element and complete the return path. Markers indicate conventional current direction, not electron speed."
    },
    {
      "name": "Monitor and startup timer",
      "role": "Forms the light request and qualifies missing current; this is a limited teaching monitor."
    },
    {
      "name": "Imposed report input",
      "role": "Supplies the schedule representing other checks outside this circuit."
    },
    {
      "name": "Command, sensing and sounder connections",
      "role": "Blue paths carry control and ideal voltage sensing. Separate leads connect the backup sounder to the powered monitor."
    },
    {
      "name": "Backup sounder",
      "role": "Turns the retained request into five repeating pulse envelopes and optional synthesized sound."
    },
    {
      "name": "Report history",
      "role": "Records the supplied report over the observed past; unpowered information is unavailable."
    },
    {
      "name": "Command history",
      "role": "Records the requested switch state, including startup and later-report edges."
    },
    {
      "name": "Visible lamp history",
      "role": "Records the illumination produced by actual calculated branch current."
    }
  ],
  "deeper": [
    {
      "title": "Follow the energy path",
      "body": "The LED branch is a chosen DC equivalent: Vs = 12 V, R = 1000 Ω, and conducting LED drop Vf = 2 V. With a closed switch and intact lead, I = (Vs − Vf)/R = 0.010 A. Source power VsI = 0.120 W equals resistor loss I²R = 0.100 W plus LED input VfI = 0.020 W. The ideal switch dissipates zero; monitor and sounder consumption are outside this branch balance."
    },
    {
      "title": "Why the resistor belongs in series",
      "body": "An LED is not a fixed resistance. Its current changes strongly with forward voltage. The series resistor takes the remaining supply voltage and limits branch current. The fixed 2 V drop used here is a local teaching approximation. Real forward voltage changes with current, temperature and manufacturing variation; the cited red-LED data sheet illustrates those dependencies."
    },
    {
      "title": "Electronic conduction has no moving contact",
      "body": "A driver can use a semiconductor switch to connect an LED load. The visible bar stands for the conducting or interrupted electrical route. It does not claim that a transistor physically opens a metal contact. Switch drive voltage, finite on-resistance, leakage, switching transitions and protection structures are omitted. A stuck conducting state is imposed to show why the requested state and delivered current must be distinguished."
    },
    {
      "title": "The exact request rule",
      "body": "With power on, command = initial interval OR external report. Startup is active for 0 ≤ t < 6 s. A from-start report is present throughout; a later report becomes present at exactly 8 s. Thus commanded-on durations over the 12 s record are 6, 12 and 10 s for the three report schedules. These command durations remain independent of an open lamp lead."
    },
    {
      "title": "Why use six seconds?",
      "body": "The cited Lincoln guide and Honda publication describe an approximately six-second startup indication; another Honda excerpt says a few seconds. The sharp boundary here makes the transition inspectable. It is not a universal timing tolerance or a claim that this reduced monitor has tested an entire restraint system. The book itself supplies the dashboard-light caption, not this circuit."
    },
    {
      "title": "Sense current without measuring light",
      "body": "An ideal high-impedance measurement across the 1 kΩ resistor gives Vr = IR. A conducting branch produces 10 V across that resistor; an open branch produces 0 V. Comparing the inferred current with an on request can reveal missing current even when the lamp is dark. This model uses a chosen 1 mA threshold. It omits off-state test currents, measurement error and failures that draw current without producing adequate light."
    },
    {
      "title": "Qualify and remember missing startup current",
      "body": "All powered trials begin with a six-second on request, and the selected circuit condition stays fixed within each trial. If that request produces less than 1 mA continuously, the chosen one-second qualification finishes at t = 1 s. Before then the backup request is not recorded. After qualification it remains recorded until a fresh trial, even if command later turns off. This is an original limited diagnostic rule, not a manufacturer fault code or service memory implementation."
    },
    {
      "title": "Turn the retained request into a backup tone",
      "body": "Ford describes a backup tone when the warning lamp is not working and a repeating group of five tones. This teaching sounder uses a chosen pattern: quarter-second pulses start at 1, 1.5, 2, 2.5 and 3 simulated seconds, then repeat every four seconds. Playback runs twice simulated speed, so the audible envelope is also twice as fast. Sound on enables an 880 Hz synthesized tone only while playing; pause, Step, completion and reset are silent. Neither frequency nor loudness models a particular vehicle sounder."
    },
    {
      "title": "A dark lamp at seven seconds is ambiguous",
      "body": "At 7 s with no external report, both a working branch and an open branch have an off command and a dark lens. The working branch carried startup current; the open branch did not. Their earlier light records differ, and only the open branch has the retained missing-current backup request in this model. Present command/light agreement does not erase that evidence."
    },
    {
      "title": "A continuous request can mask a stuck switch",
      "body": "With a report present from the start, the working and stuck conducting switches both pass 10 mA throughout. Their command and visible-light histories are identical, and neither has missing current. Because no off state is requested, these observations cannot show whether the switch can stop conducting. The selected failure control is additional known information, not a diagnosis inferred from the light."
    },
    {
      "title": "Power and observation are different",
      "body": "With common power off, report, command and diagnostic information are unavailable. The LED current, electrical power and physical light are zero, and the backup is off. The observer’s clock can still advance. Gaps in unavailable report and command records must not be read as healthy low signals. Changing power starts a fresh trial rather than modeling retained vehicle memory through a power interruption."
    },
    {
      "title": "Warning, activation and passenger status differ",
      "body": "A warning informs the observer about a reported condition; it does not request airbag inflation. The Crash sensor lesson illustrates acceleration sensing and a separate demonstration threshold. That threshold does not feed the report here. Honda also distinguishes an SRS warning from a passenger-airbag-OFF status display. This circuit neither classifies occupants nor decides deployment."
    }
  ],
  "misconception": "A light matching its command now does not prove the output path is healthy. A continuous on command can make a working path and a stuck-on path produce identical complete histories. Use the supplied conditions and the observed past to explain what the display can and cannot distinguish.",
  "quiz": {
    "question": "A report is present from the start. One output works and another is stuck illuminated. What can their command and visible-light histories distinguish during this twelve-second trial?",
    "options": [
      "The stuck output always creates a mismatch.",
      "The two histories are identical, so these observations cannot distinguish the paths.",
      "The working output must go dark at six seconds.",
      "Matching histories prove both paths can turn the lamp off."
    ],
    "answer": 1,
    "explanation": "The report keeps the command on throughout. Both the working and stuck-illuminated paths therefore stay lit, and both comparisons read Matches. There is no off-command interval to reveal the different responses. The imposed path selection is additional information, not a conclusion inferred from the lamp."
  },
  "tryIt": [
    {
      "title": "Follow normal startup",
      "instruction": "Set up this experiment. Inspect 3 s, then Inspect 6 s boundary and Inspect final record (12 s). Select Inspect the record to follow the three rows.",
      "observe": "The powered lamp and command are on at three seconds and off from six seconds onward. No report is supplied. The visible record retains six seconds of initial light; later darkness alone does not describe that history. The conducting LED branch draws 10 mA; current becomes zero when the switch opens.",
      "values": {
        "power": 1,
        "report": 0,
        "lamp": 0,
        "sound": 0
      },
      "reset": true,
      "part": "circuit",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Report a condition from the start",
      "instruction": "Set up this experiment. Compare Inspect 3 s with Inspect 7 s, then inspect the final record.",
      "observe": "The report, command and lamp remain on after the initial interval ends. Matches describes the output following its command; it does not mean that no condition was reported.",
      "values": {
        "power": 1,
        "report": 1,
        "lamp": 0,
        "sound": 0
      },
      "reset": true,
      "part": "circuit",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Report a condition after startup",
      "instruction": "Set up this experiment. Inspect 7 s and then Inspect 8 s boundary. Use Inspect the record to compare the exact changes.",
      "observe": "At seven seconds the report is absent and command and lamp are off. At eight seconds the supplied report, command and lamp become on. The command and visible record each contain a two-second dark interval from six to eight seconds.",
      "values": {
        "power": 1,
        "report": 2,
        "lamp": 0,
        "sound": 0
      },
      "reset": true,
      "part": "records",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Remove the visible startup check",
      "instruction": "Inspect 3 s and the open LED lead, then Inspect backup onset (1 s) and Inspect between tones (1.25 s). Select Sound on and Play to hear the backup sequence. Inspect 7 s and the record afterward.",
      "observe": "The on command closes the switch, but the open LED lead keeps current at zero. The backup request is recorded only after one observed second of missing current. At 7 s the light matches its off command, while the retained request still drives the backup pattern.",
      "values": {
        "power": 1,
        "report": 0,
        "lamp": 1,
        "sound": 0
      },
      "reset": true,
      "part": "lamp",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Hide a reported condition behind a dark lamp",
      "instruction": "Set up this experiment. Inspect 7 s, select Inspect the warning lamp, then Inspect the record.",
      "observe": "The report is present and the command is on, yet the lens remains dark. Command and visible output differ throughout. The dark lens does not negate the supplied report. Branch current remains zero and the missing-current backup request is retained after 1 s.",
      "values": {
        "power": 1,
        "report": 1,
        "lamp": 1,
        "sound": 0
      },
      "reset": true,
      "part": "circuit",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Report a later condition with a failed lamp",
      "instruction": "Set up this experiment. Compare Inspect 7 s with Inspect 8 s boundary and inspect all three record rows.",
      "observe": "The report and command switch on at eight seconds, but the lamp stays dark. Its unchanging appearance hides that later change. The comparison differs during startup, matches during six to eight seconds, then differs again. The retained backup request persists across those changes.",
      "values": {
        "power": 1,
        "report": 2,
        "lamp": 1,
        "sound": 0
      },
      "reset": true,
      "part": "records",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Keep the lamp lit after its command ends",
      "instruction": "Set up this experiment. Inspect 6 s boundary, then Inspect 7 s and Inspect the indicator path.",
      "observe": "No report is supplied. The command turns off at six seconds while the powered lamp remains lit. Current illumination can come from the imposed output behavior rather than a present report. The stuck conducting switch still passes 10 mA through the intact LED branch.",
      "values": {
        "power": 1,
        "report": 0,
        "lamp": 2,
        "sound": 0
      },
      "reset": true,
      "part": "indicator-path",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Mask a stuck lamp with a continuous command",
      "instruction": "Set up this experiment. Inspect the final record and compare it with Report a condition from the start.",
      "observe": "The command and lamp stay on throughout, exactly as they do with the working output in that comparison trial. The comparison always matches. These histories cannot reveal which output path was imposed because the monitor never requests darkness.",
      "values": {
        "power": 1,
        "report": 1,
        "lamp": 2,
        "sound": 0
      },
      "reset": true,
      "part": "records",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "See agreement return without erasing the past",
      "instruction": "Set up this experiment. Inspect 7 s, then Inspect 8 s boundary and Inspect 9 s. Select Inspect the record.",
      "observe": "The stuck lamp is lit at every stage. At seven seconds its command is off, so the comparison differs. From eight seconds the later report requests light and the comparison matches again. The record still shows the earlier two-second mismatch; agreement is not evidence of a repair.",
      "values": {
        "power": 1,
        "report": 2,
        "lamp": 2,
        "sound": 0
      },
      "reset": true,
      "part": "records",
      "isolate": true,
      "view": "front"
    },
    {
      "title": "Remove power from the example",
      "instruction": "Set up this experiment. Inspect 3 s and Inspect 9 s, then inspect the record. Observe the difference between a dark output and unavailable information.",
      "observe": "The lens stays dark while report, command and comparison are unavailable. The observer’s time advances, but the monitor has no power. Report and command have unavailable gaps, not low-valued healthy signals. Current, LED-branch power and backup output are zero.",
      "values": {
        "power": 0,
        "report": 0,
        "lamp": 0,
        "sound": 0
      },
      "reset": true,
      "part": "circuit",
      "isolate": true,
      "view": "front"
    }
  ],
  "limits": "Original teaching circuit extending the book’s dashboard-light caption with manufacturer context. Chosen 12 V ideal supply, ideal high-side switch, 1 kΩ resistor and constant 2 V LED drop give 10 mA when conducting. Cannot illuminate is modeled as an open LED lead; Stuck illuminated holds the switch conducting. No thermal response, leakage, electrical transients, brightness calibration or semiconductor switching physics. An ideal high-impedance resistor-voltage measurement qualifies current below 1 mA during the startup on request for one second and retains a backup request within that trial. The five-pulse cadence, 880 Hz optional tone and qualification delay are teaching choices, not manufacturer specifications. Monitor and sounder consumption are outside LED-branch power readings. The nominal six-second startup comes from approximate published examples; report onset at 8 s and the 12 s record are chosen. Six display seconds cover twelve simulated seconds. Only the observed history is shown. Full restraint monitoring, intermittent failures, power-cycle memory, occupant classification, fault codes, vehicle diagnosis and crash activation are outside this model.",
  "sources": [
    {
      "title": "Ford: 1997 Lincoln Mark VIII owner guide, readiness indicator, printed page 149",
      "url": "https://www.fordservicecontent.com/Ford_Content/catalog/owner_guides/97mrkog1e.pdf"
    },
    {
      "title": "Ford: Crash Sensors and Airbag Indicator",
      "url": "https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G2475239&Uid=G2469222&buildtype=web&countryCode=USA&div=f&languageCode=en&moidRef=G2127755&userMarket=USA&vFilteringEnabled=False&variantid=10485"
    },
    {
      "title": "Honda: Accord Body Repair News, August 2015, indicator distinctions on page 10",
      "url": "https://techinfo.honda.com/rjanisis/pubs/web/ABN50089.PDF"
    },
    {
      "title": "Honda: 2023 Civic Sedan owner manual, Airbag System Indicators",
      "url": "https://owners.honda.com/utility/download?path=%2Fstatic%2Fpdfs%2F2023%2FCivic+Sedan%2F2023_Civic_4D_Airbags.PDF"
    },
    {
      "title": "Texas Instruments: How to Drive Resistive, Inductive, Capacitive, and Lighting Loads, sections 5.3, 5.6 and 5.7",
      "url": "https://www.ti.com/lit/an/slvae30e/slvae30e.pdf"
    },
    {
      "title": "Kingbright: WP7113ID red LED data sheet, electrical characteristics",
      "url": "https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf"
    }
  ]
};
