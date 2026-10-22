import re
from datetime import datetime

def get_recommendations(connection, current_product_ids):
    """
    Market Basket Analysis (Item Co-occurrence AI).
    Finds products that are most frequently purchased together in historical orders.
    Falls back to highest sales velocity products if history is sparse.
    """
    cursor = connection.cursor()
    try:
        # Sanitize product IDs as integers
        valid_ids = [int(p) for p in current_product_ids if str(p).isdigit()]
        
        recommendations = []
        
        if valid_ids:
            placeholders = ', '.join(['%s'] * len(valid_ids))
            # 1. Co-occurrence query: Find items purchased in the same order as current_product_ids
            co_query = f"""
                SELECT p.product_id, p.name, p.price_per_unit, u.uom_name, COUNT(*) as frequency
                FROM order_details od1
                JOIN order_details od2 ON od1.order_id = od2.order_id AND od1.product_id != od2.product_id
                JOIN products p ON od2.product_id = p.product_id
                JOIN uom u ON p.uom_id = u.uom_id
                WHERE od1.product_id IN ({placeholders}) AND od2.product_id NOT IN ({placeholders})
                GROUP BY p.product_id, p.name, p.price_per_unit, u.uom_name
                ORDER BY frequency DESC
                LIMIT 3
            """
            cursor.execute(co_query, tuple(valid_ids + valid_ids))
            for row in cursor.fetchall():
                recommendations.append({
                    'product_id': row[0],
                    'name': row[1],
                    'price': float(row[2]),
                    'uom': row[3],
                    'reason': 'Frequently Bought Together',
                    'confidence': 'High Co-occurrence'
                })

        # 2. Fallback query: If no co-occurrences found, recommend top selling or popular products not in cart
        exclude_ids = valid_ids + [r['product_id'] for r in recommendations]
        needed = 4 - len(recommendations)
        
        if needed > 0:
            if exclude_ids:
                ex_placeholders = ', '.join(['%s'] * len(exclude_ids))
                fallback_query = f"""
                    SELECT p.product_id, p.name, p.price_per_unit, u.uom_name, COALESCE(SUM(od.quantity), 0) as total_sold
                    FROM products p
                    JOIN uom u ON p.uom_id = u.uom_id
                    LEFT JOIN order_details od ON p.product_id = od.product_id
                    WHERE p.product_id NOT IN ({ex_placeholders})
                    GROUP BY p.product_id, p.name, p.price_per_unit, u.uom_name
                    ORDER BY total_sold DESC, p.name ASC
                    LIMIT %s
                """
                cursor.execute(fallback_query, tuple(exclude_ids + [needed]))
            else:
                fallback_query = """
                    SELECT p.product_id, p.name, p.price_per_unit, u.uom_name, COALESCE(SUM(od.quantity), 0) as total_sold
                    FROM products p
                    JOIN uom u ON p.uom_id = u.uom_id
                    LEFT JOIN order_details od ON p.product_id = od.product_id
                    GROUP BY p.product_id, p.name, p.price_per_unit, u.uom_name
                    ORDER BY total_sold DESC, p.name ASC
                    LIMIT %s
                """
                cursor.execute(fallback_query, (needed,))

            for row in cursor.fetchall():
                recommendations.append({
                    'product_id': row[0],
                    'name': row[1],
                    'price': float(row[2]),
                    'uom': row[3],
                    'reason': 'Popular Item',
                    'confidence': 'High Velocity'
                })

        return recommendations
    finally:
        cursor.close()


def parse_natural_order(connection, text):
    """
    NLP Entity & Quantity Extractor (Named Entity Recognition).
    Parses conversational text such as:
    '2 kg Rice, 1 Toothpaste, and 5 Atta for Rahul Verma'
    into structured customer name and item rows.
    """
    cursor = connection.cursor()
    try:
        if not text or not text.strip():
            return {'customer_name': '', 'items': []}

        clean_text = text.strip()

        # 1. Extract Customer Name using regex entity heuristics with word boundaries
        customer_name = ''
        name_patterns = [
            r'\b(?:for|customer|cust|client)\s*[:=-]?\s*([A-Za-z\s]+?)(?:$|,|\.|\n)',
            r'^\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:bought|ordered|wants|needs)\b',
        ]
        for pattern in name_patterns:
            match = re.search(pattern, clean_text, re.IGNORECASE)
            if match:
                extracted = match.group(1).strip()
                # Exclude common stop words
                if extracted.lower() not in ['a', 'the', 'some', 'me', 'order', 'items', 'item']:
                    customer_name = extracted.title()
                    break

        # 2. Fetch catalog products to perform keyword entity matching
        cursor.execute("SELECT product_id, name, price_per_unit, uom_id FROM products")
        products = cursor.fetchall()

        parsed_items = []
        matched_product_ids = set()

        for prod_id, prod_name, price, uom_id in products:
            escaped_name = re.escape(prod_name)
            
            # Pattern A: "<number> <unit>? of? <product_name>" (e.g. "2 kg of Rice", "3 Toothpaste")
            pattern_a = rf'(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|each|units?|packets?|pcs?|box|nos?)?\s*(?:of\s+)?{escaped_name}\b'
            # Pattern B: "<product_name> <number>" (e.g. "Rice 2", "Toothpaste 3")
            pattern_b = rf'\b{escaped_name}\s*[:=-]?\s*(\d+(?:\.\d+)?)'

            match = re.search(pattern_a, clean_text, re.IGNORECASE) or re.search(pattern_b, clean_text, re.IGNORECASE)

            if match:
                qty = float(match.group(1))
                if qty > 0 and prod_id not in matched_product_ids:
                    parsed_items.append({
                        'product_id': prod_id,
                        'name': prod_name,
                        'price': float(price),
                        'quantity': qty
                    })
                    matched_product_ids.add(prod_id)
            else:
                # If product name appears by itself without explicit number, default to quantity 1
                if re.search(rf'\b{escaped_name}\b', clean_text, re.IGNORECASE) and prod_id not in matched_product_ids:
                    parsed_items.append({
                        'product_id': prod_id,
                        'name': prod_name,
                        'price': float(price),
                        'quantity': 1.0
                    })
                    matched_product_ids.add(prod_id)

        return {
            'customer_name': customer_name,
            'items': parsed_items,
            'raw_input': text
        }
    finally:
        cursor.close()


def get_ai_insights(connection):
    """
    AI Retail Advisor & Sales Forecaster.
    Analyzes historical patterns and generates dynamic, plain-language business advice.
    """
    cursor = connection.cursor()
    try:
        # 1. Total order metrics
        cursor.execute("SELECT COUNT(*), COALESCE(SUM(total), 0), COALESCE(AVG(total), 0) FROM orders")
        order_metrics = cursor.fetchone()
        order_count = order_metrics[0] or 0
        total_revenue = float(order_metrics[1] or 0)
        avg_order = float(order_metrics[2] or 0)

        # 2. Top velocity item
        cursor.execute("""
            SELECT p.name, COALESCE(SUM(od.quantity), 0) as qty, u.uom_name, COALESCE(SUM(od.total_price), 0) as rev
            FROM products p
            JOIN uom u ON p.uom_id = u.uom_id
            LEFT JOIN order_details od ON p.product_id = od.product_id
            GROUP BY p.product_id, p.name, u.uom_name
            ORDER BY qty DESC
            LIMIT 1
        """)
        top_row = cursor.fetchone()
        top_product = top_row[0] if top_row else 'None'
        top_qty = float(top_row[1]) if top_row else 0
        top_uom = top_row[2] if top_row else ''

        # 3. Item count per basket
        cursor.execute("SELECT COALESCE(AVG(cnt), 0) FROM (SELECT COUNT(*) as cnt FROM order_details GROUP BY order_id) as t")
        basket_row = cursor.fetchone()
        avg_basket_items = round(float(basket_row[0]), 1) if basket_row and basket_row[0] else 1.0

        # Heuristic Insights
        insights = []
        if order_count > 0 and top_qty > 0:
            insights.append({
                'type': 'trend',
                'icon': 'fa-fire-flame-curved',
                'color': 'warning',
                'title': f'Top Selling Item: {top_product}',
                'detail': f'Customers have purchased {top_qty} {top_uom} of {top_product}. Ensure warehouse inventory is well-stocked.'
            })

        insights.append({
            'type': 'basket',
            'icon': 'fa-basket-shopping',
            'color': 'primary',
            'title': f'Average Basket Size: {avg_basket_items} items',
            'detail': 'AI recommends cross-selling complementary products at checkout to increase Average Basket Size above 3.0 items.'
        })

        # Forecast
        daily_pace = round(total_revenue / max(order_count, 1) * 1.15, 2)
        insights.append({
            'type': 'forecast',
            'icon': 'fa-chart-pie',
            'color': 'success',
            'title': 'AI Revenue Projection',
            'detail': f'Estimated revenue momentum projected at Rs. {daily_pace:.2f} per transaction cycle based on current basket velocity.'
        })

        return {
            'top_product': top_product,
            'avg_basket_items': avg_basket_items,
            'insights': insights
        }
    finally:
        cursor.close()
