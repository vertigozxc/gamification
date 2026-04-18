#!/bin/bash
ENDPOINTS=(
  "A https://life-rpg-api-router.evgeny-mahnach.workers.dev/healthz GET"
  "B https://life-rpg-api-eu.onrender.com/healthz GET"
  "C https://life-rpg-api.onrender.com/healthz GET"
  "D https://life-rpg-api-router.evgeny-mahnach.workers.dev/api/auth/mobile-bridge-check/bench POST"
  "E https://life-rpg-api-eu.onrender.com/api/auth/mobile-bridge-check/bench POST"
)

format="%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total}\n"

for ep in "${ENDPOINTS[@]}"; do
  read -r ID URL METHOD <<< "$ep"
  FILE="bench_${ID}.txt"
  echo "Benchmarking $ID: $URL ($METHOD)" >&2
  
  # Get headers
  if [ "$METHOD" == "POST" ]; then
    curl -i -s -X POST -H 'Origin: https://life-rpg-api-router.evgeny-mahnach.workers.dev' -H 'Content-Type: application/json' --data '{}' "$URL" | sed -n '1,20p' > "headers_${ID}.txt"
  else
    curl -i -s "$URL" | sed -n '1,20p' > "headers_${ID}.txt"
  fi

  for i in {1..20}; do
    if [ "$METHOD" == "POST" ]; then
      curl -s -o /dev/null -w "$format" -X POST -H 'Origin: https://life-rpg-api-router.evgeny-mahnach.workers.dev' -H 'Content-Type: application/json' --data '{}' "$URL" >> "$FILE"
    else
      curl -s -o /dev/null -w "$format" "$URL" >> "$FILE"
    fi
  done
done

awk_script='
BEGIN {
    printf "%-10s %-10s %-10s %-10s %-10s\n", "Metric", "Avg", "Min", "Max", "SD"
}
{
    dns[NR]=$1; con[NR]=$2; tls[NR]=$3; tt[NR]=$4; tot[NR]=$5
    s1+=$1; s2+=$2; s3+=$3; s4+=$4; s5+=$5
}
END {
    m1=s1/NR; m2=s2/NR; m3=s3/NR; m4=s4/NR; m5=s5/NR
    for(i=1;i<=NR;i++) {
        v1+=(dns[i]-m1)^2; v2+=(con[i]-m2)^2; v3+=(tls[i]-m3)^2; v4+=(tt[i]-m4)^2; v5+=(tot[i]-m5)^2
        if(i==1){min1=max1=dns[i]; min2=max2=con[i]; min3=max3=tls[i]; min4=max4=tt[i]; min5=max5=tot[i]}
        if(dns[i]<min1) min1=dns[i]; if(dns[i]>max1) max1=dns[i]
        if(con[i]<min2) min2=con[i]; if(con[i]>max2) max2=con[i]
        if(tls[i]<min3) min3=tls[i]; if(tls[i]>max3) max3=tls[i]
        if(tt[i]<min4) min4=tt[i]; if(tt[i]>max4) max4=tt[i]
        if(tot[i]<min5) min5=tot[i]; if(tot[i]>max5) max5=tot[i]
    }
    printf "%-10s %-10.4f %-10.4f %-10.4f %-10.4f\n", "DNS", m1, min1, max1, sqrt(v1/NR)
    printf "%-10s %-10.4f %-10.4f %-10.4f %-10.4f\n", "Connect", m2-m1, min2-min1, max2-max1, sqrt(v2/NR)
    printf "%-10s %-10.4f %-10.4f %-10.4f %-10.4f\n", "TLS", m3-m2, min3-min2, max3-max2, sqrt(v3/NR)
    printf "%-10s %-10.4f %-10.4f %-10.4f %-10.4f\n", "TTFB", m4-m3, min4-min3, max4-max3, sqrt(v4/NR)
    printf "%-10s %-10.4f %-10.4f %-10.4f %-10.4f\n", "Total", m5, min5, max5, sqrt(v5/NR)
}'

for ID in A B C D E; do
  echo "------------------------------------------------------------"
  echo "ENDPOINT $ID HEADERS:"
  cat "headers_${ID}.txt"
  echo ""
  echo "ENDPOINT $ID METRICS (seconds):"
  awk "$awk_script" "bench_${ID}.txt"
done
