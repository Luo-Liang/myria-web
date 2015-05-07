from backend import Backend
from clang_catalog import ClangCatalog
from clang_connection import ClangConnection
import myria
import requests
from raco.language.clang import CCAlgebra


class ClangBackend(Backend):
    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl
        self.connection = ClangConnection(self.hostname, self.port, self.ssl)

    def catalog(self):
        return ClangCatalog(self.connection)

    def algebra(self):
        return CCAlgebra('file')

    def compile_query(self, query, logical_plan, physical_plan, language=None):
        return self.connection.create_json(
            query, logical_plan, physical_plan)

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        try:
            compiled = self.connection.create_execute_json(
                query, logical_plan, physical_plan, "clang")
            query_status = self.connection.submit_query(compiled)
            query_url = 'http://%s:%d/query?qid=%d' %\
                        (self.hostname, self.port, query_status['queryId'])
            return {'query_status': query_status, 'query_url': query_url}
        except myria.MyriaError as e:
            raise e
        except requests.ConnectionError as e:
            raise e

    def get_query_status(self, query_id):
        return self.connection.check_query(query_id)

    def connection_string(self):
        conn = self.connection
        if not conn:
            return "unable to connect to %s:%d" % (self.hostname, self.port)
        else:
            return "%s:%d[1/1]" % (self.hostname, self.port)

    def connection_url(self, uri_scheme):
        return "http://{h}:{p}".format(h=self.hostname, p=self.port)

    def backend_url(self):
        return "ftp://ftp.cs.washington.edu/tr/2014/10/UW-CSE-14-10-01.pdf"

    def queries(self, limit, max_id, min_id, q):
        return self.connection.queries(limit, max_id, min_id, q)
