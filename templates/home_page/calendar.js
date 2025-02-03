// 事件数据示例
const events = {
    "2025-02-03": ["买菜", "开会"],
    "2025-02-05": ["约会"],
    // 更多日期和事件...
  };
  
  // 生成当前月份日历（星期一作为第一天）
  function generateCalendar(year, month) {
    const calendarDiv = document.getElementById('calendar');
    const monthNames = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
    let html = `<table>
      <caption>${year}年 ${monthNames[month]}</caption>
      <thead>
        <tr>
          <th>一</th>
          <th>二</th>
          <th>三</th>
          <th>四</th>
          <th>五</th>
          <th>六</th>
          <th>日</th>
        </tr>
      </thead>
      <tbody>`;
    const firstDay = new Date(year, month, 1).getDay();
    const offset = (firstDay + 6) % 7; // 使星期一为第一天
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let date = 1;
    for (let i = 0; i < 6; i++) {
      html += "<tr>";
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < offset) {
          html += "<td></td>";
        } else if (date > daysInMonth) {
          html += "<td></td>";
        } else {
          // 格式化日期 "YYYY-MM-DD"
          const m = month + 1 < 10 ? "0" + (month + 1) : month + 1;
          const d = date < 10 ? "0" + date : date;
          const fullDate = `${year}-${m}-${d}`;
          // 如果存在事件，则显示标记
          const eventMark = events[fullDate] ? "<div style='color:red;font-size:0.8em'>●</div>" : "";
          html += `<td data-date="${fullDate}">${date}${eventMark}</td>`;
          date++;
        }
      }
      html += "</tr>";
      if (date > daysInMonth) break;
    }
    html += "</tbody></table>";
    calendarDiv.innerHTML = html;
  }
  const today = new Date();
  generateCalendar(today.getFullYear(), today.getMonth());
  
  // 点击日期单元格显示事件详情
  document.getElementById('calendar').addEventListener('click', function(e) {
    const td = e.target.closest('td[data-date]');
    if (td) {
      const date = td.getAttribute('data-date');
      const eventList = events[date] || [];
      alert(date + "\n" + (eventList.length ? eventList.join("\n") : "无事件"));
    }
  });
  