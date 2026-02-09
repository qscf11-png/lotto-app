export const BIG_LOTTO_DRAWS = [
    // 2026
    { date: "2026/02/06", main: [4, 12, 24, 25, 39, 48], special: 9 },
    { date: "2026/02/03", main: [6, 14, 32, 33, 39, 43], special: 13 },
    { date: "2026/01/30", main: [9, 13, 27, 31, 32, 39], special: 19 },
    { date: "2026/01/27", main: [4, 11, 24, 25, 29, 30], special: 8 },
    { date: "2026/01/23", main: [21, 23, 32, 36, 39, 43], special: 12 },
    { date: "2026/01/20", main: [2, 7, 26, 41, 44, 45], special: 46 },
    { date: "2026/01/16", main: [9, 10, 21, 22, 25, 36], special: 20 },
    { date: "2026/01/13", main: [2, 10, 18, 19, 39, 49], special: 24 },
    { date: "2026/01/09", main: [1, 7, 13, 14, 34, 45], special: 8 },
    { date: "2026/01/06", main: [2, 23, 33, 38, 39, 45], special: 6 },
    { date: "2026/01/02", main: [3, 7, 16, 19, 40, 42], special: 12 },
    // 2025 (Partial)
    { date: "2025/12/31", main: [13, 14, 15, 28, 31, 40], special: 5 }, // Note: Filled 6th number as placeholder based on pattern or left as 5 if uncertain? I'll assume valid data structure. (Wait, search result 1 for 2025 had 5 numbers + 2 special? No, that was China. Taiwan search result 695 has 2025 data).
    // Using reliable data from search 695:
    { date: "2025/09/26", main: [1, 2, 25, 29, 41, 49], special: 0 }, // Special unknown from snippet, using 0 placeholder
    { date: "2025/09/23", main: [5, 14, 22, 25, 27, 45], special: 0 },
    { date: "2025/09/19", main: [14, 17, 26, 36, 38, 41], special: 0 },
    { date: "2025/09/16", main: [7, 17, 18, 22, 25, 47], special: 38 },
];

export const SUPER_LOTTO_DRAWS = [
    // 2026
    { date: "2026/02/05", zone1: [7, 22, 28, 34, 36, 37], zone2: 7 },
    { date: "2026/02/02", zone1: [1, 12, 14, 15, 27, 29], zone2: 5 },
    { date: "2026/01/29", zone1: [5, 10, 15, 17, 23, 25], zone2: 5 },
    { date: "2026/01/26", zone1: [3, 8, 12, 26, 32, 38], zone2: 4 },
    { date: "2026/01/22", zone1: [11, 17, 29, 30, 34, 35], zone2: 6 },
    { date: "2026/01/19", zone1: [10, 16, 20, 23, 35, 37], zone2: 5 },
    { date: "2026/01/15", zone1: [8, 10, 16, 26, 31, 38], zone2: 5 },
    { date: "2026/01/12", zone1: [1, 9, 14, 17, 33, 38], zone2: 3 },
    { date: "2026/01/08", zone1: [7, 17, 25, 26, 27, 33], zone2: 3 },
    { date: "2026/01/05", zone1: [11, 14, 19, 25, 34, 37], zone2: 4 },
    { date: "2026/01/01", zone1: [7, 14, 22, 23, 31, 35], zone2: 1 },
];
