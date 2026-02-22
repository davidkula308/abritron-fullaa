
from flask import Flask, request, jsonify
import MetaTrader5 as mt5

app = Flask(__name__)
mt5.initialize()

@app.route('/trade', methods=['POST'])
def trade():
    data = request.json
    symbol = data['symbol']
    lot = float(data['lot'])
    side = data['side']
    order_type = mt5.ORDER_TYPE_BUY if side == 'BUY' else mt5.ORDER_TYPE_SELL
    tick = mt5.symbol_info_tick(symbol)
    price = tick.ask if side == 'BUY' else tick.bid
    request_order = {
        'action': mt5.TRADE_ACTION_DEAL,
        'symbol': symbol,
        'volume': lot,
        'type': order_type,
        'price': price,
        'deviation': 20,
        'magic': 234000,
        'comment': 'Arbitron AI Trade',
        'type_time': mt5.ORDER_TIME_GTC,
        'type_filling': mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request_order)
    return jsonify({'retcode': result.retcode, 'order': result.order, 'price': result.price})

if __name__ == '__main__':
    app.run(port=9000)
