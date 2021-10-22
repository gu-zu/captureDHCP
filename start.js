const dgram = require("dgram"),
    net = require("os").networkInterfaces();

// show the network(s) the device is on and thus monitoring
for (it in net) {
    for (ip of net[it])
        if (!ip.internal && ip.family == "IPv4")
            console.log(ip.family, "network:", ip.cidr);
}

const sock = dgram.createSocket("udp4");
sock.on("message", (msg, sender) => {
    parseDHCP(msg);
});
function parseDHCP(buff) {
    //parse raw options fields to js object
    if (buff.length < 260) return;
    const opts = {};
    for (let i = 240; i != null; ) {
        if (i >= buff.length) break;
        const v = buff.readUInt8(i);
        if (v == 255) break;
        if (v == 53 && buff.readUInt8(i + 2) != 3) return;
        const l = buff.readUInt8(i + 1);
        opts[v] = Buffer.from(buff.buffer, i + 2, l);
        i += l + 2;
    }
    //make readable
    if (!opts[12]) return;
    const opte = {};
    const map = {
        /*53: ["msgtype", (v) => v.readUInt8()], /*
        1     DHCPDISCOVER
        2     DHCPOFFER
        3     DHCPREQUEST
        4     DHCPDECLINE
        5     DHCPACK
        6     DHCPNAK
        7     DHCPRELEASE */
        12: ["host", (v) => v.toString()],
        50: [
            "reqIP",
            (v) => {
                const r = [];
                for (let i = 0; i < 4; i++) r.push(v.readUInt8(i));
                return r.join(".");
            },
        ],
        61: [
            "id",
            (v) => {
                const r = [];
                for (let i = 1; i < 7; i++)
                    r.push(
                        v
                            .readUInt8(i)
                            .toString(16)
                            .padStart(2, "0")
                            .toUpperCase()
                    );
                return r.join(":");
            },
        ], //mac
    };
    for (op in opts) if (map[op]) opte[map[op][0]] = map[op][1](opts[op]);
    console.log(opte);
    if (process.argv[2] == "save") write(opte); //write to file if specified
}
sock.on("close", () => console.log("close"));
sock.on("listening", () => console.log("listening"));
sock.on("error", (e) => console.log("err", e));
sock.bind(67, () => sock.setBroadcast(true));

function write(obj) {
    require("fs").appendFileSync(
        "./DHCP-cap",
        JSON.stringify(obj, null, "  ") + "\n"
    );
}
