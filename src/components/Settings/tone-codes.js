export const CTCSS_TONES = [
    { freq: "67.0", desc: "XZ" },
    { freq: "69.3", desc: "WZ" },
    { freq: "71.9", desc: "XA" },
    { freq: "74.4", desc: "WA" },
    { freq: "77.0", desc: "XB" },
    { freq: "79.7", desc: "WB" },
    { freq: "82.5", desc: "YZ" },
    { freq: "85.4", desc: "YA" },
    { freq: "88.5", desc: "YB" },
    { freq: "91.5", desc: "ZZ" },
    { freq: "94.8", desc: "ZA" },
    { freq: "97.4", desc: "ZB" },
    { freq: "100.0", desc: "1Z" },
    { freq: "103.5", desc: "1A" },
    { freq: "107.2", desc: "1B" },
    { freq: "110.9", desc: "2Z" },
    { freq: "114.8", desc: "2A" },
    { freq: "118.8", desc: "2B" },
    { freq: "123.0", desc: "3Z" },
    { freq: "127.3", desc: "3A" },
    { freq: "131.8", desc: "3B" },
    { freq: "136.5", desc: "4Z" },
    { freq: "141.3", desc: "4A" },
    { freq: "146.2", desc: "4B" },
    { freq: "151.4", desc: "5Z" },
    { freq: "156.7", desc: "5A" },
    { freq: "162.2", desc: "5B" },
    { freq: "167.9", desc: "6Z" },
    { freq: "173.8", desc: "6A" },
    { freq: "179.9", desc: "6B" },
    { freq: "186.2", desc: "7Z" },
    { freq: "192.8", desc: "7A" },
    { freq: "203.5", desc: "M1" },
    { freq: "210.7", desc: "M2" },
    { freq: "218.1", desc: "M3" },
    { freq: "225.7", desc: "M4" },
    { freq: "233.6", desc: "M5" },
    { freq: "241.8", desc: "M6" },
    { freq: "250.3", desc: "M7" }
  ];
  
  export const DCS_CODES = {
    // Normal DCS Codes
    normal: [
      "023", "025", "026", "031", "032", "036", "043", "047", "051", "053",
      "054", "065", "071", "072", "073", "074", "114", "115", "116", "122",
      "125", "131", "132", "134", "143", "145", "152", "155", "156", "162",
      "165", "172", "174", "205", "212", "223", "225", "226", "243", "244",
      "245", "246", "251", "252", "255", "261", "263", "265", "266", "271",
      "274", "306", "311", "315", "325", "331", "332", "343", "346", "351",
      "356", "364", "365", "371", "411", "412", "413", "423", "431", "432",
      "445", "446", "452", "454", "455", "462", "464", "465", "466", "503",
      "506", "516", "523", "526", "532", "546", "565", "606", "612", "624",
      "627", "631", "632", "654", "662", "664", "703", "712", "723", "731",
      "732", "734", "743", "754"
    ],
    // Inverted DCS Codes (preceded by 'i')
    inverted: [
      "i023", "i025", "i026", "i031", "i032", "i036", "i043", "i047", "i051", "i053",
      "i054", "i065", "i071", "i072", "i073", "i074", "i114", "i115", "i116", "i122",
      "i125", "i131", "i132", "i134", "i143", "i145", "i152", "i155", "i156", "i162",
      "i165", "i172", "i174", "i205", "i212", "i223", "i225", "i226", "i243", "i244",
      "i245", "i246", "i251", "i252", "i255", "i261", "i263", "i265", "i266", "i271",
      "i274", "i306", "i311", "i315", "i325", "i331", "i332", "i343", "i346", "i351",
      "i356", "i364", "i365", "i371", "i411", "i412", "i413", "i423", "i431", "i432",
      "i445", "i446", "i452", "i454", "i455", "i462", "i464", "i465", "i466", "i503",
      "i506", "i516", "i523", "i526", "i532", "i546", "i565", "i606", "i612", "i624",
      "i627", "i631", "i632", "i654", "i662", "i664", "i703", "i712", "i723", "i731",
      "i732", "i734", "i743", "i754"
    ]
  };
  
  // Helper function to check if a tone/code is valid
  export const isValidTone = (tone) => {
    if (tone.startsWith('DCS')) {
      const code = tone.substring(4); // Remove "DCS " prefix
      return DCS_CODES.normal.includes(code) || DCS_CODES.inverted.includes('i' + code);
    } else if (tone.startsWith('CTCSS')) {
      const freq = tone.substring(6); // Remove "CTCSS " prefix
      return CTCSS_TONES.some(t => t.freq === freq);
    }
    return false;
  };
  
  // Helper function to format tone display
  export const formatTone = (tone) => {
    if (tone.startsWith('CTCSS')) {
      return `${tone} Hz`;
    }
    return tone; // DCS codes don't need Hz
  };